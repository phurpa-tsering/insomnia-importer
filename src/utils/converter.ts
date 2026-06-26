import yaml from 'js-yaml';
import type {
  InsomniaExport,
  InsomniaRequest,
  InsomniaBody,
  InsomniaResource,
  InsomniaV5Export,
  InsomniaV5Item,
} from './types';
import {
  isInsomniaWorkspace,
  isInsomniaRequestGroup,
  isInsomniaRequest,
  isInsomniaV5Export,
  isInsomniaV5Folder,
} from './types';
import { getVoidenApiHelpers } from './useVoidenApiHelpers';

export function sanitizeName(name: string): string {
  return name
    .trim()
    .replace(/\/+/g, '-')
    .replace(/[^a-zA-Z0-9-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function convertAuthToHeaders(auth: InsomniaRequest['authentication']): Array<{ name: string; value: string }> {
  if (!auth || !auth.type || auth.type === 'none') return [];

  const headers: Array<{ name: string; value: string }> = [];

  if (auth.type === 'basic' && auth.username != null) {
    const credentials = `${auth.username}:${auth.password ?? ''}`;
    const encoded = btoa(credentials);
    headers.push({ name: 'Authorization', value: `Basic ${encoded}` });
  } else if ((auth.type === 'bearer' || auth.type === 'oauth2') && auth.token) {
    const prefix = auth.prefix ?? 'Bearer';
    headers.push({ name: 'Authorization', value: `${prefix} ${auth.token}` });
  } else if (auth.type === 'apikey' && auth.key && (auth.addTo === 'header' || !auth.addTo)) {
    headers.push({ name: auth.key, value: auth.value ?? '' });
  }

  return headers;
}

const makeUid = () => Math.random().toString(36).slice(2, 10);

// Extract :paramName segments from the URL path (before query string)
function extractPathParams(url: string): string[] {
  const path = url.split('?')[0];
  const matches = [...path.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)];
  return [...new Set(matches.map(m => m[1]))];
}

// Convert Insomnia's colon-style path segments (:id) to Voiden's brace-style
// placeholders ({id}), e.g. "https://api.com/:id/:bye" -> "https://api.com/{id}/{bye}"
function convertColonPathParams(url: string): string {
  return url.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');
}

type BodyType = 'json' | 'xml' | 'yaml' | 'binary' | 'text' | 'multipart' | 'skip';

// YAML: application/x-yaml · application/yaml · text/yaml · text/x-yaml
// Binary: application/octet-stream · application/binary · application/pdf ·
//         application/zip · application/x-zip-compressed · application/gzip ·
//         application/x-gzip · application/x-tar · application/x-rar-compressed ·
//         application/x-7z-compressed · image/* · video/* · audio/*
// Skip: application/x-www-form-urlencoded · application/graphql
function classifyBody(body: InsomniaBody): BodyType {
  const mime = body.mimeType ?? '';

  if (
    mime === 'application/x-www-form-urlencoded' ||
    mime === 'application/graphql'
  ) return 'skip';

  if (mime === 'multipart/form-data') return 'multipart';

  // YAML — all common variants contain 'yaml' or 'yml'
  if (mime.includes('yaml') || mime.includes('yml')) return 'yaml';

  // Text-based formats
  if (mime.includes('json')) return 'json';
  if (mime.includes('xml') || mime.includes('html')) return 'xml';
  if (mime === 'text/plain') return 'text';

  // Binary — major-type prefixes and known application binaries
  if (
    mime.startsWith('image/') ||
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    mime === 'application/octet-stream' ||
    mime === 'application/binary' ||
    mime === 'application/pdf' ||
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'application/x-zip' ||
    mime === 'application/gzip' ||
    mime === 'application/x-gzip' ||
    mime === 'application/x-tar' ||
    mime === 'application/x-rar-compressed' ||
    mime === 'application/x-7z-compressed'
  ) return 'binary';

  // No declared mime — sniff the text content
  if (body.text) {
    const t = body.text.trim();
    if (t.startsWith('{') || t.startsWith('[')) return 'json';
    if (t.startsWith('<')) return 'xml';
  }

  if (body.params && body.params.length > 0) return 'multipart';

  return 'text';
}

// Return the actual MIME content-type string to embed in the block attrs
function resolveContentType(body: InsomniaBody, type: BodyType): string {
  if (body.mimeType && body.mimeType !== '') return body.mimeType;
  switch (type) {
    case 'json': return 'application/json';
    case 'xml': return 'application/xml';
    case 'yaml': return 'application/yaml';
    case 'text': return 'text/plain';
    default: return 'text/plain';
  }
}

export const convertInsomniaRequestToVoidenSchema = async (data: InsomniaRequest): Promise<string> => {
  try {
    const helpers = getVoidenApiHelpers();
    const blocks: any[] = [];

    console.log(`Converting request "${data.name}" (${data.method} ${data.url}) to Voiden schema...`);
    // 1. Method + URL
    blocks.push({
      type: 'request',
      content: [
        helpers.createMethodNode(data.method),
        helpers.createUrlNode(convertColonPathParams(data.url)),
      ],
    });

    // 2. Headers (auth headers merged with request headers)
    const authHeaders = convertAuthToHeaders(data.authentication);
    const activeHeaders = (data.headers ?? []).filter(h => !h.disabled);
    const allHeaders = [
      ...authHeaders.map(h => [h.name, h.value] as [string, string]),
      ...activeHeaders.map(h => [h.name, h.value] as [string, string]),
    ];
    if (allHeaders.length > 0) {
      blocks.push(helpers.createHeadersTableNode(allHeaders));
    }

    // 3. Path parameters — extracted from :paramName segments in the URL
    const pathParams = extractPathParams(data.url);
    if (pathParams.length > 0) {
      blocks.push(
        helpers.createPathParamsTableNode(
          pathParams.map(p => [p, ''] as [string, string])
        )
      );
    }

    // 4. Query parameters
    const activeParams = (data.parameters ?? []).filter(p => !p.disabled);
    if (activeParams.length > 0) {
      blocks.push(
        helpers.createQueryTableNode(
          activeParams.map(p => [p.name, p.value] as [string, string])
        )
      );
    }

    // 5. Body — url-encoded and graphql are skipped (not supported in Voiden blocks)
    if (data.body) {
      const body = data.body;
      const bodyType = classifyBody(body);
      console.log(`Classified body of request "${data.name}" as type "${bodyType}" based on MIME type "${body.mimeType}" and content analysis.`);
      if (bodyType !== 'skip') {
        const contentType = resolveContentType(body, bodyType);

        if (bodyType === 'binary') {
          console.warn(`Request "${data.name}" has a binary body. Voiden's API blocks don't support embedding binary content, so a placeholder file block will be created for manual attachment.`);
          blocks.push({ type: 'restFile', attrs: { uid: makeUid(), fieldName: 'file' } });
        } else if (bodyType === 'multipart') {
          const active = (body.params ?? []).filter(p => !p.disabled);
          if (active.length > 0) {
            blocks.push(
              helpers.createMultipartTableNode(
                active.map(p => [p.name, p.value ?? ''] as [string, string])
              )
            );
          }
        } else if (body.text) {
          if (bodyType === 'yaml') {
            console.warn(`Request "${data.name}" has a YAML body. Since Voiden doesn't have a native YAML block, it will be imported as a plain text block with the content type set to "application/yaml". You may want to change the block type to "YAML Body" manually after import for better editing experience.`);
            blocks.push({
              type: "yml_body",
              attrs: { uid: makeUid(), importedFrom: "", contentType, body: String(body.text) },
            });
          } else if (bodyType === 'xml') {
            blocks.push(helpers.createXMLBodyNode(body.text, contentType));
          } else {
            blocks.push(helpers.createJsonBodyNode(body.text, contentType));
          }
        }
      }
    }

    return helpers.convertBlocksToVoidFile(data.name, blocks);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to convert "${data.name}" (${data.method} ${data.url}): ${detail}`);
  }
};

export const createSingleFile = async (request: InsomniaRequest, currentPath: string, fileName: string) => {
  let content = await convertInsomniaRequestToVoidenSchema(request);
  if (request.description) {
    content += request.description;
  }
  const result = await (window as any).electron?.files?.createVoid(currentPath, fileName);
  if (result?.path) {
    await (window as any).electron?.files?.write(result.path, content);
  }
};

interface TreeNode {
  resource: InsomniaResource;
  children: TreeNode[];
}

function buildTree(resources: InsomniaResource[], parentId: string): TreeNode[] {
  return resources
    .filter(r => r.parentId === parentId)
    .map(r => ({
      resource: r,
      children: buildTree(resources, r._id),
    }));
}

export const countTotalRequests = (nodes: TreeNode[]): number => {
  let count = 0;
  for (const node of nodes) {
    if (isInsomniaRequest(node.resource)) count += 1;
    count += countTotalRequests(node.children);
  }
  return count;
};

export const processNodes = async (
  nodes: TreeNode[],
  currentPath: string,
  onProgress?: (current: number, total: number) => void,
  progressState = { current: 0, total: 0 },
  onError?: (itemName: string, error: unknown) => void,
  signal?: { cancelled: boolean },
) => {
  for (const node of nodes) {
    if (signal?.cancelled) return;

    const resource = node.resource;

    try {
      if (isInsomniaRequestGroup(resource)) {
        const folderName = sanitizeName(resource.name);
        const actualFolderName = await (window as any).electron?.files?.createDirectory(currentPath, folderName);
        const folderPath = `${currentPath}/${actualFolderName}`;
        await processNodes(node.children, folderPath, onProgress, progressState, onError, signal);
      } else if (isInsomniaRequest(resource)) {
        try {
          await createSingleFile(resource, currentPath, sanitizeName(resource.name));
        } catch (error) {
          onError?.(resource.name, error);
          progressState.current += 1;
          onProgress?.(progressState.current, progressState.total);
          continue;
        }
        progressState.current += 1;
        onProgress?.(progressState.current, progressState.total);
      }

      await new Promise(resolve => setTimeout(resolve, 20));
    } catch (error) {
      throw error;
    }
  }
};

// Flattens a v5 collection tree (folders/requests nested via `children`) into
// the same flat `InsomniaResource[]` shape the v4 importer already works with
// (_id/_type/parentId), so buildTree/processNodes/countTotalRequests need no
// v5-specific logic.
function normalizeV5ToResources(data: InsomniaV5Export): InsomniaResource[] {
  const resources: InsomniaResource[] = [];
  const rootId = data.meta?.id ?? 'wrk_root';

  resources.push({
    _id: rootId,
    _type: 'workspace',
    parentId: null,
    name: data.name,
  });

  let counter = 0;
  const nextId = (prefix: string) => `${prefix}_${counter++}`;

  const walk = (items: InsomniaV5Item[], parentId: string) => {
    for (const item of items) {
      if (isInsomniaV5Folder(item)) {
        const folderId = item.meta?.id ?? nextId('fld');
        resources.push({
          _id: folderId,
          _type: 'request_group',
          parentId,
          name: item.name,
        });
        walk(item.children, folderId);
      } else {
        resources.push({
          _id: item.meta?.id ?? nextId('req'),
          _type: 'request',
          parentId,
          name: item.name,
          method: item.method,
          url: item.url,
          headers: item.headers,
          parameters: item.parameters,
          body: item.body,
          authentication: item.authentication,
        });
      }
    }
  };

  walk(data.collection ?? [], rootId);

  return resources;
}

// Insomnia v4 exports are JSON with `_type: "export"`. Newer Insomnia versions
// (v5+) export YAML (or JSON) with a `type: collection.insomnia.rest/5.x` marker
// and a nested `collection` tree instead of a flat `resources` array.
function parseInsomniaCollection(raw: string): InsomniaResource[] {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = yaml.load(raw);
  }

  if (isInsomniaV5Export(parsed)) {
    return normalizeV5ToResources(parsed as InsomniaV5Export);
  }

  const data = parsed as InsomniaExport;
  if (data?._type === 'export' && Array.isArray(data.resources)) {
    return data.resources;
  }

  throw new Error('Unrecognized Insomnia export format (expected v4 JSON or v5 YAML/JSON)');
}

export const importInsomniaCollection = async (
  collectionJson: string,
  activeProject: string,
  onProgress?: (current: number, total: number) => void,
  onError?: (itemName: string, error: unknown) => void,
  signal?: { cancelled: boolean },
) => {
  if (!activeProject) {
    throw new Error('No active project found');
  }

  const resources = parseInsomniaCollection(collectionJson);

  const workspaces = resources.filter(isInsomniaWorkspace);
  if (workspaces.length === 0) {
    throw new Error('No workspace found in Insomnia export');
  }

  for (const workspace of workspaces) {
    if (signal?.cancelled) break;

    const tree = buildTree(resources, workspace._id);
    const totalItems = countTotalRequests(tree);
    const progressState = { current: 0, total: totalItems };

    const rootFolderName = sanitizeName(workspace.name);
    const actualRootFolderName = await (window as any).electron?.files?.createDirectory(activeProject, rootFolderName);
    const rootPath = `${activeProject}/${actualRootFolderName}`;

    if (workspace.description) {
      const result = await (window as any).electron?.files?.createVoid(rootPath, rootFolderName);
      if (result?.path) {
        await (window as any).electron?.files?.write(result.path, workspace.description);
      }
    }

    await processNodes(tree, rootPath, onProgress, progressState, onError, signal);
  }

  return { success: true, message: 'Collection imported successfully' };
};
