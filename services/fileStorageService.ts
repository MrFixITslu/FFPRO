/**
 * Fire Finance - Hybrid Storage Engine
 * Persistence using IndexedDB with optional SSD Mirroring.
 */

const DB_NAME = 'FireFinance_v1';
const DATA_STORE = 'app_state';
const DOC_STORE = 'internal_docs';
const MIRROR_HANDLE_STORE = 'mirror_handles';

// FIX: Add timeout wrapper for file operations to prevent hanging
const TIMEOUT_MS = 10000; // 10 second timeout

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 4); // Incremented version
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DATA_STORE)) db.createObjectStore(DATA_STORE);
      if (!db.objectStoreNames.contains(MIRROR_HANDLE_STORE)) db.createObjectStore(MIRROR_HANDLE_STORE);
      if (!db.objectStoreNames.contains(DOC_STORE)) db.createObjectStore(DOC_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Internal Document CRUD (Bypasses FileSystem API)
 */
export const saveInternalDoc = async (id: string, content: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOC_STORE, 'readwrite');
    transaction.objectStore(DOC_STORE).put(content, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getInternalDoc = async (id: string): Promise<string | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOC_STORE, 'readonly');
    const request = transaction.objectStore(DOC_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const deleteInternalDoc = async (id: string): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction(DOC_STORE, 'readwrite');
  transaction.objectStore(DOC_STORE).delete(id);
};

/**
 * Universal Download Utility
 */
export const triggerSecureDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 2000);
};

/**
 * SSD Mirroring Logic
 */
export const saveFileToHardDrive = async (
  directoryHandle: FileSystemDirectoryHandle,
  projectName: string,
  fileName: string,
  blob: Blob
): Promise<string> => {
  try {
    // FIX: Add timeout to prevent hanging
    const save = async () => {
      const folderName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const projectFolder = await directoryHandle.getDirectoryHandle(folderName, { create: true });
      const fileHandle = await projectFolder.getFileHandle(fileName, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(blob);
      await writable.close();
      return `${folderName}/${fileName}`;
    };
    return await withTimeout(save());
  } catch (error) {
    console.warn("Hardware mirror failed, fallback to internal db only.", error);
    throw error;
  }
};

/**
 * Auto-Save Backup Logic
 */
export const saveBackupToHardDrive = async (
  directoryHandle: FileSystemDirectoryHandle,
  data: any
): Promise<void> => {
  try {
    // FIX: Add timeout to prevent hanging
    const backup = async () => {
      const backupFolder = await directoryHandle.getDirectoryHandle("Fire Finance Backups", { create: true });
      const fileName = `vault_auto_backup.json`;
      const fileHandle = await backupFolder.getFileHandle(fileName, { create: true });
      const writable = await (fileHandle as any).createWritable();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      await writable.write(blob);
      await writable.close();
    };
    return await withTimeout(backup());
  } catch (error) {
    console.warn("Auto-backup mirror write failed. Check permissions.", error);
    throw error;
  }
};

export const getFileFromHardDrive = async (
  directoryHandle: FileSystemDirectoryHandle,
  storageRef: string
): Promise<Blob> => {
  const [folderName, fileName] = storageRef.split('/');
  const projectFolder = await directoryHandle.getDirectoryHandle(folderName);
  const fileHandle = await projectFolder.getFileHandle(fileName);
  return await fileHandle.getFile();
};

export const storeMirrorHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MIRROR_HANDLE_STORE, 'readwrite');
    transaction.objectStore(MIRROR_HANDLE_STORE).put(handle, 'active_mirror');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getStoredVaultHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MIRROR_HANDLE_STORE, 'readonly');
    const request = transaction.objectStore(MIRROR_HANDLE_STORE).get('active_mirror');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const clearVaultHandle = async () => {
  const db = await initDB();
  const transaction = db.transaction(MIRROR_HANDLE_STORE, 'readwrite');
  transaction.objectStore(MIRROR_HANDLE_STORE).delete('active_mirror');
};
