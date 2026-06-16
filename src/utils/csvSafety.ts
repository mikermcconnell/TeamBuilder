const DANGEROUS_SPREADSHEET_PREFIX = /^[\t\r\n ]*[=+\-@]/;

export function sanitizeCSVCellForSpreadsheet(cell: string): string {
  return DANGEROUS_SPREADSHEET_PREFIX.test(cell) ? `'${cell}` : cell;
}

export function formatCSVCell(cell: string): string {
  const safeCell = sanitizeCSVCellForSpreadsheet(cell);
  return `"${safeCell.replace(/"/g, '""')}"`;
}

