import { FolderRecord, PresentationRecord } from "./types";

const DB_NAME = "shikshaslide_offline_db";
const DB_VERSION = 1;
const DECK_STORE = "presentations";
const META_KEY_FOLDERS = "shikshaslide_folders_cache_v1";
const META_KEY_PREFS = "shikshaslide_ui_prefs_v1";

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DECK_STORE)) {
          db.createObjectStore(DECK_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function savePresentationsToOfflineStore(
  decks: PresentationRecord[]
): Promise<void> {
  const db = await openIdb();
  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(DECK_STORE, "readwrite");
      const store = tx.objectStore(DECK_STORE);
      for (const d of decks) {
        store.put(d);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
  try {
    // Also mirror lightweight metadata + recent decks to localStorage as fallback
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "shikshaslide_decks_backup_v1",
        JSON.stringify(decks.slice(0, 25))
      );
    }
  } catch {
    // Ignore quota errors on large decks since IndexedDB holds full data
  }
}

export async function upsertSingleOfflineDeck(
  deck: PresentationRecord
): Promise<void> {
  const db = await openIdb();
  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(DECK_STORE, "readwrite");
      tx.objectStore(DECK_STORE).put(deck);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
}

export async function removeOfflineDeck(id: string): Promise<void> {
  const db = await openIdb();
  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(DECK_STORE, "readwrite");
      tx.objectStore(DECK_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
}

export async function loadOfflinePresentations(): Promise<PresentationRecord[]> {
  const db = await openIdb();
  if (db) {
    const items = await new Promise<PresentationRecord[]>((resolve) => {
      const tx = db.transaction(DECK_STORE, "readonly");
      const req = tx.objectStore(DECK_STORE).getAll();
      req.onsuccess = () => resolve((req.result as PresentationRecord[]) || []);
      req.onerror = () => resolve([]);
    });
    if (items.length > 0) {
      return items.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
  }
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("shikshaslide_decks_backup_v1");
      if (raw) return JSON.parse(raw) as PresentationRecord[];
    } catch {
      return [];
    }
  }
  return [];
}

export function saveOfflineFolders(folders: FolderRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(META_KEY_FOLDERS, JSON.stringify(folders));
  } catch {
    // ignore
  }
}

export function loadOfflineFolders(): FolderRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(META_KEY_FOLDERS);
    return raw ? (JSON.parse(raw) as FolderRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveUiModePreference(mode: "light" | "dark") {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(META_KEY_PREFS, mode);
  } catch {
    // ignore
  }
}

export function loadUiModePreference(): "light" | "dark" | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(META_KEY_PREFS);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}
