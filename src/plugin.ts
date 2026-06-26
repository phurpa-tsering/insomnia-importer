/**
 * Insomnia Collection Importer Extension
 *
 * Imports Insomnia v4 (.json) and v5 (.yaml/.yml/.json) export files and
 * converts them to Voiden .void request files.
 *
 * Features:
 * - Import Insomnia v4 export JSON files and v5 export YAML/JSON files
 * - Automatic conversion to Voiden's .void format
 * - Preserves folder (request_group) structure
 * - Supports headers, request bodies, query parameters, and authentication
 * - Progress tracking during import
 */

import { PluginContext } from '@voiden/sdk/ui';
import React from 'react';
import { InsomniaImportButton } from './components/InsomniaImportButton';

const insomniaImportPlugin = (context: PluginContext) => {
  const showToast = (context as any)?.ui?.showToast as
    | ((message: string, type?: 'info' | 'success' | 'warning' | 'error') => void)
    | undefined;

  return {
    onload: () => {
      context.registerEditorAction({
        id: 'insomnia-import-button',
        component: (props: any) =>
          React.createElement(InsomniaImportButton, {
            ...props,
            showToast,
          }),
        predicate: (tab) => {
          // Show for .json (v4) or .yaml/.yml/.json (v5) files that look like Insomnia exports
          const title = tab.title ?? '';
          const isCandidateFile = title.endsWith('.json') || title.endsWith('.yaml') || title.endsWith('.yml');
          if (!isCandidateFile) return false;

          const c = tab.content ?? '';
          const isV4 = c.includes('__export_format') || c.includes('"_type":"export"') || c.includes('"_type": "export"');
          const isV5 = c.includes('collection.insomnia.rest/');
          return isV4 || isV5;
        },
      });
    },
    onunload: () => {},
  };
};

export default insomniaImportPlugin;
