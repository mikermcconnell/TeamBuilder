export function getGroupLabelFromIndex(index: number): string {
  if (!Number.isFinite(index) || index < 0) {
    return 'A';
  }

  let value = Math.floor(index);
  let label = '';

  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);

  return label;
}

export function normalizeGroupLabel(label: string): string {
  const trimmed = label.trim();

  if (!trimmed) {
    return trimmed;
  }

  if (/^[A-Z]+$/.test(trimmed)) {
    return trimmed;
  }

  if (/^G\d+$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  if (trimmed.length === 1) {
    const code = trimmed.charCodeAt(0);

    if (code >= 91 && code <= 126) {
      return getGroupLabelFromIndex(code - 65);
    }

    if (code >= 65 && code <= 90) {
      return trimmed.toUpperCase();
    }
  }

  return trimmed;
}

export function sanitizeLegacyTeamName(name: string): string {
  const trimmed = name.trim();
  const match = trimmed.match(/^(group)\s+(\S+)\s+(.+)$/i);

  if (!match) {
    return trimmed;
  }

  const normalizedLabel = normalizeGroupLabel(match[2] || '');
  const rest = match[3]?.trim() || '';

  if (!normalizedLabel || !rest) {
    return trimmed;
  }

  return `Group ${normalizedLabel} ${rest}`;
}
