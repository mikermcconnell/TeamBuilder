export function getFirebaseErrorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined;
}

export function isFirestoreIndexError(error: unknown): boolean {
  return getFirebaseErrorCode(error) === 'failed-precondition'
    || (error instanceof Error && error.message.includes('index'));
}
