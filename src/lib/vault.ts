/**
 * Keeps this browser's copy of the account's data key in IndexedDB, as a
 * non-extractable CryptoKey: pages can use it to encrypt and decrypt, but no
 * script can read the key's bytes out. Cleared on sign-out.
 */

const DB = "levitating-vault";
const STORE = "keys";
const SLOT = "current";

type Entry = { username: string; key: CryptoKey };

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveKey(username: string, key: CryptoKey) {
  await run("readwrite", (s) => s.put({ username: username.toLowerCase(), key } satisfies Entry, SLOT));
}

/** The stored key, if it belongs to `username`. */
export async function loadKey(username: string) {
  try {
    const entry = (await run("readonly", (s) => s.get(SLOT))) as Entry | undefined;
    return entry && entry.username === username.toLowerCase() ? entry.key : null;
  } catch {
    return null;
  }
}

export async function clearKey() {
  try {
    await run("readwrite", (s) => s.delete(SLOT));
  } catch {
    // Nothing stored, or storage blocked: either way there's no key left.
  }
}

// The recovery code for a just-created (or re-keyed) account, shown once after
// the redirect that follows sign-up. Session storage only: gone when the tab closes.
const PENDING = "ln-recovery-pending";

export function setPendingRecovery(code: string) {
  try {
    sessionStorage.setItem(PENDING, code);
  } catch {}
}

export function takePendingRecovery() {
  try {
    return sessionStorage.getItem(PENDING);
  } catch {
    return null;
  }
}

export function clearPendingRecovery() {
  try {
    sessionStorage.removeItem(PENDING);
  } catch {}
}
