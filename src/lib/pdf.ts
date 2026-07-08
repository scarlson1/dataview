/**
 * Minimal client-side PDF export, the @react-pdf/renderer counterpart to
 * `downloadCsv`. Takes a rendered `<Document>` element (see src/components/pdf/),
 * turns it into a blob, and triggers a browser download.
 *
 * The code-split boundary for @react-pdf/renderer (~1 MB) is the *document*
 * modules under src/components/pdf/, which statically import the renderer and
 * are themselves loaded via `import()` at the call site. This helper only ever
 * runs inside those lazily-loaded chunks, so it imports the renderer directly —
 * a dynamic import here would be redundant and keep the renderer out of the main
 * bundle either way.
 */

import { type DocumentProps, pdf } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

export const downloadPdf = async (
  filename: string,
  document: ReactElement<DocumentProps>,
): Promise<void> => {
  const blob = await pdf(document).toBlob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
