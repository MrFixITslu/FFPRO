
import { getStoredVaultHandle, storeMirrorHandle, clearVaultHandle } from './fileStorageService';

export interface AppState {
  transactions: any[];
  recurringExpenses: any[];
  recurringIncomes: any[];
  savingGoals: any[];
  investmentGoals: any[];
  categoryBudgets: Record<string, number>;
  bankConnections: any[];
  investments: any[];
  events: any[];
  calendarItems: any[];
  contacts: any[];
  cashOpeningBalance: number;
  lastUpdated: string;
}

// FIX: Add timeout wrapper for vault operations
const VAULT_TIMEOUT_MS = 10000; // 10 seconds

function withVaultTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Vault operation timed out')), VAULT_TIMEOUT_MS)
    )
  ]);
}

/**
 * Vault Service
 * Manages the connection to a local folder and syncing the app state to a JSON file.
 */
export const vaultService = {
  /**
   * Request user to pick a directory for the vault.
   */
  async connectVault(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      await storeMirrorHandle(handle);
      return handle;
    } catch (err) {
      console.error('Failed to connect vault:', err);
      return null;
    }
  },

  /**
   * Get the current vault handle if it exists.
   */
  async getHandle(): Promise<FileSystemDirectoryHandle | null> {
    return await getStoredVaultHandle();
  },

  /**
   * Disconnect the vault.
   */
  async disconnectVault(): Promise<void> {
    await clearVaultHandle();
  },

  /**
   * Save the entire app state to the vault.
   */
  async saveState(handle: FileSystemDirectoryHandle, state: AppState): Promise<void> {
    try {
      // FIX: Add timeout to prevent hanging
      const save = async () => {
        const fileHandle = await handle.getFileHandle('vault.json', { create: true });
        const writable = await (fileHandle as any).createWritable();
        const content = JSON.stringify(state, null, 2);
        await writable.write(content);
        await writable.close();
      };
      await withVaultTimeout(save());
    } catch (err) {
      console.error('Failed to save state to vault:', err);
      throw err;
    }
  },

  /**
   * Load the app state from the vault.
   */
  async loadState(handle: FileSystemDirectoryHandle): Promise<AppState | null> {
    try {
      // FIX: Add timeout to prevent hanging
      const load = async () => {
        const fileHandle = await handle.getFileHandle('vault.json');
        const file = await fileHandle.getFile();
        const content = await file.text();
        return JSON.parse(content) as AppState;
      };
      return await withVaultTimeout(load());
    } catch (err) {
      console.warn('Vault file not found or invalid:', err);
      return null;
    }
  }
};
