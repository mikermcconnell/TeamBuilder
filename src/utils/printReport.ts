const REPORT_PRINT_STYLES = `
  body { font-family: Arial, sans-serif; margin: 20px; }
  pre { white-space: pre-wrap; font-family: Arial, sans-serif; }
`;

export function buildTextReportPrintDocument(document: Document, reportText: string): void {
  document.open();
  document.write('<!doctype html><html><head><title>Team Report</title></head><body></body></html>');
  document.close();

  const style = document.createElement('style');
  style.textContent = REPORT_PRINT_STYLES;
  document.head.appendChild(style);

  const report = document.createElement('pre');
  report.textContent = reportText;
  document.body.appendChild(report);
}

export function openTextReportPrintWindow(reportText: string): boolean {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return false;
  }

  buildTextReportPrintDocument(printWindow.document, reportText);
  printWindow.print();
  return true;
}

