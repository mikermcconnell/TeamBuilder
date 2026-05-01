export function formatSavedWorkspaceUpdatedAt(
  updatedAt: string | number | Date | null | undefined,
  locale?: string,
  timeZone?: string
): string {
  if (!updatedAt) {
    return 'N/A';
  }

  const date = new Date(updatedAt);

  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}
