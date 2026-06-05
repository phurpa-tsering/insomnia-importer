/**
 * Insomnia Collection Importer Extension
 *
 * Imports Insomnia v4 export files (.json) and converts them to Voiden .void request files.
 *
 * Features:
 * - Import Insomnia v4 export JSON files
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
          // Show only for .json files that look like Insomnia exports
          if (!tab.title?.endsWith('.json')) return false;
          const c = tab.content ?? '';
          return c.includes('__export_format') || c.includes('"_type":"export"') || c.includes('"_type": "export"');
        },
      });
    },
    onunload: () => {},
  };
};

export default insomniaImportPlugin;
