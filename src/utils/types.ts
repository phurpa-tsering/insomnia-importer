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
