import { describe, expect, it } from 'vitest';

import { buildTextReportPrintDocument } from '@/utils/printReport';

describe('printReport', () => {
  it('renders report text as text content, not executable HTML', () => {
    const printDocument = document.implementation.createHTMLDocument('');
    const reportText = '<img src=x onerror="alert(1)">Team Report';

    buildTextReportPrintDocument(printDocument, reportText);

    expect(printDocument.querySelector('img')).toBeNull();
    expect(printDocument.querySelector('pre')?.textContent).toBe(reportText);
    expect(printDocument.body.innerHTML).toContain('&lt;img');
  });
});

