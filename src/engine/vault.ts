import type { World } from './world';

const DB_NAME = 'oppu';
const STORE = 'vault';
const KEY = 'world.v3';

/**
 * CryptoKey objects are structured-cloneable, and a key generated as
 * non-extractable stays non-extractable when it is stored and read back. That
 * is what lets a wallet keep the same device identity across reloads without
 * the private key ever being serialisable — the same property a production
 * wallet relies on.
 */
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export async function saveWorld(world: World): Promise<boolean> {
  try {
    await tx('readwrite', (s) => s.put(world, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function loadWorld(): Promise<World | null> {
  try {
    const value = await tx<World | undefined>('readonly', (s) => s.get(KEY));
    if (!value || !value.students?.length) return null;
    return value;
  } catch {
    return null;
  }
}

export async function clearVault(): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(KEY));
  } catch {
    /* nothing stored */
  }
}

export function vaultAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}
