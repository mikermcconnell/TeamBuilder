import { StructuredWarning, parseWarningMessage } from '@/types/StructuredWarning';

const normalizeName = (name?: string) => name?.trim().toLowerCase() ?? '';

const dedupeNames = (names: string[]) => {
  const seen = new Set<string>();

  return names.filter(name => {
    const normalized = normalizeName(name);
    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
};

export function isAvoidWarning(warning: StructuredWarning): boolean {
  return warning.message.includes('Avoid request');
}

export function applyWarningResolutionToRequests(
  requests: string[],
  warning: StructuredWarning,
  appendIfMissing: boolean
): string[] {
  if (!warning.matchedName) {
    return requests;
  }

  const requestedName = normalizeName(warning.requestedName);
  const parsedWarning = parseWarningMessage(warning.message);
  const previousMatches = new Set([
    normalizeName(parsedWarning.matchedName),
    normalizeName(warning.matchedName),
  ]);
  let didReplace = false;

  const updatedRequests = requests.map(request => {
    const normalizedRequest = normalizeName(request);

    if (
      normalizedRequest &&
      (normalizedRequest === requestedName || previousMatches.has(normalizedRequest))
    ) {
      didReplace = true;
      return warning.matchedName!;
    }

    return request;
  });

  if (!didReplace && appendIfMissing) {
    updatedRequests.push(warning.matchedName);
  }

  return dedupeNames(updatedRequests);
}
