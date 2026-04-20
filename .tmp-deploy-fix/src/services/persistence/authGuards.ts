import type { User } from 'firebase/auth';

interface AuthLike {
  currentUser: User | null;
  onAuthStateChanged: (callback: (user: User | null) => void) => () => void;
}

export async function waitForAuthenticatedUser(auth: AuthLike, timeoutMs = 15000): Promise<User | null> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise((resolve) => {
    let settled = false;
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (settled) {
        return;
      }

      settled = true;
      unsubscribe();
      resolve(user);
    });

    setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      unsubscribe();
      resolve(null);
    }, timeoutMs);
  });
}

export async function ensureCurrentUserMatches(
  auth: AuthLike,
  userId: string,
  options?: {
    timeoutMs?: number;
    onMismatchMessage?: string;
  }
): Promise<boolean> {
  if (!userId) {
    return false;
  }

  const currentUser = await waitForAuthenticatedUser(auth, options?.timeoutMs);
  if (!currentUser) {
    return false;
  }

  if (currentUser.uid !== userId) {
    if (options?.onMismatchMessage) {
      console.warn(options.onMismatchMessage);
    }
    return false;
  }

  return true;
}
