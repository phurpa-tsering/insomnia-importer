/**
 * Hook to access voiden-api plugin helpers
 */

export interface VoidenApiHelpers {
  createMethodNode: (method: string) => any;
  createUrlNode: (url: string) => any;
  createHeadersTableNode: (headers: [string, string][]) => any;
  createJsonBodyNode: (body: string, contentType: string) => any;
  createXMLBodyNode: (body: string, contentType: string) => any;
  createMultipartTableNode: (formData: [string, string][]) => any;
  createUrlTableNode: (formData: [string, string][]) => any;
  createPathTableNode: (params: [string, string][]) => any;
  createQueryTableNode: (params: [string, string][]) => any;
  convertToVoidMarkdown: (jsonContent: any) => Promise<string>;
  convertBlocksToVoidFile: (title: string, blocks: any[]) => string;
  insertParagraphAfterRequestBlocks: (content: any[]) => any[];
}

export function getVoidenApiHelpers(): VoidenApiHelpers {
  const helpers = (window as any).__voidenHelpers__?.['voiden-wrapper-api-extension'];

  if (!helpers) {
    throw new Error(
      'Voiden API helpers not found. Make sure voiden-wrapper-api-extension is loaded before insomnia-import.'
    );
  }

  return helpers;
}
