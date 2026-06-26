/**
 * Insomnia Collection Types (Export Format v4)
 */

export interface InsomniaExport {
  _type: 'export';
  __export_format: 4;
  __export_date?: string;
  __export_source?: string;
  resources: InsomniaResource[];
}

export type InsomniaResource = InsomniaWorkspace | InsomniaRequestGroup | InsomniaRequest;

export interface InsomniaWorkspace {
  _id: string;
  _type: 'workspace';
  parentId: null | string;
  name: string;
  description?: string;
  scope?: 'collection' | 'design' | 'mock-server';
}

export interface InsomniaRequestGroup {
  _id: string;
  _type: 'request_group';
  parentId: string;
  name: string;
  description?: string;
  environment?: Record<string, string>;
}

export interface InsomniaRequest {
  _id: string;
  _type: 'request';
  parentId: string;
  name: string;
  method: string;
  url: string;
  description?: string;
  body?: InsomniaBody;
  headers?: InsomniaHeader[];
  parameters?: InsomniaParameter[];
  authentication?: InsomniaAuthentication;
}

export interface InsomniaHeader {
  id?: string;
  name: string;
  value: string;
  disabled?: boolean;
}

export interface InsomniaParameter {
  id?: string;
  name: string;
  value: string;
  disabled?: boolean;
}

export interface InsomniaBody {
  mimeType?: string;
  text?: string;
  params?: InsomniaFormParam[];
}

export interface InsomniaFormParam {
  id?: string;
  name: string;
  value: string;
  type?: 'file' | 'text';
  disabled?: boolean;
}

export interface InsomniaAuthentication {
  type: string;
  // Bearer
  token?: string;
  prefix?: string;
  // Basic
  username?: string;
  password?: string;
  // API Key
  key?: string;
  value?: string;
  addTo?: 'header' | 'queryParams';
  // OAuth2 — just preserve token if available
  accessTokenUrl?: string;
  clientId?: string;
}

export function isInsomniaWorkspace(r: InsomniaResource): r is InsomniaWorkspace {
  return r._type === 'workspace';
}

export function isInsomniaRequestGroup(r: InsomniaResource): r is InsomniaRequestGroup {
  return r._type === 'request_group';
}

export function isInsomniaRequest(r: InsomniaResource): r is InsomniaRequest {
  return r._type === 'request';
}

/**
 * Insomnia Collection Types (Export Format v5 — newer Insomnia versions)
 *
 * Exported as YAML (or JSON) with a `type: collection.insomnia.rest/5.0` marker.
 * Unlike v4, there's no flat `resources` array with `_type`/`parentId` — it's a
 * nested tree under `collection`, where folders are distinguished by having a
 * `children` array and requests by having `url`/`method`.
 */
export interface InsomniaV5Export {
  type: string; // e.g. "collection.insomnia.rest/5.0"
  name: string;
  meta?: { id?: string; created?: number; modified?: number };
  collection?: InsomniaV5Item[];
}

export type InsomniaV5Item = InsomniaV5Folder | InsomniaV5RequestItem;

export interface InsomniaV5Folder {
  name: string;
  meta?: { id?: string };
  children: InsomniaV5Item[];
}

export interface InsomniaV5RequestItem {
  name: string;
  meta?: { id?: string };
  method: string;
  url: string;
  headers?: InsomniaHeader[];
  parameters?: InsomniaParameter[];
  body?: InsomniaBody;
  authentication?: InsomniaAuthentication;
}

export function isInsomniaV5Export(data: any): data is InsomniaV5Export {
  return !!data && typeof data.type === 'string' && data.type.startsWith('collection.insomnia.rest/');
}

export function isInsomniaV5Folder(item: InsomniaV5Item): item is InsomniaV5Folder {
  return Array.isArray((item as InsomniaV5Folder).children);
}
