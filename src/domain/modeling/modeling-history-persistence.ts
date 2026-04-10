import {
  createEmptyOperationHistory,
  validateOperationHistoryPayload,
  type ModelingOperationHistoryPayload,
  type OperationHistoryValidationResult,
} from '@/contracts/modeling/operation-history'
import type { DocumentId } from '@/contracts/shared/ids'

export const MODELING_OPERATION_HISTORY_STORAGE_KEY = 'cad.modeling.operationHistory.v1'

export interface OperationHistoryStore {
  load(): OperationHistoryValidationResult | { ok: true; payload: null }
  save(payload: ModelingOperationHistoryPayload): void
  clear(): void
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function createMemoryOperationHistoryStore(
  initialPayload: ModelingOperationHistoryPayload | null = null,
): OperationHistoryStore & { readonly savedPayloads: ModelingOperationHistoryPayload[] } {
  let payload = initialPayload ? structuredClone(initialPayload) : null
  const savedPayloads: ModelingOperationHistoryPayload[] = []

  return {
    savedPayloads,
    load() {
      if (!payload) {
        return { ok: true, payload: null }
      }

      return validateOperationHistoryPayload(structuredClone(payload))
    },
    save(nextPayload) {
      payload = structuredClone(nextPayload)
      savedPayloads.push(structuredClone(nextPayload))
    },
    clear() {
      payload = null
    },
  }
}

export function createLocalStorageOperationHistoryStore(
  storage: StorageLike,
  key = MODELING_OPERATION_HISTORY_STORAGE_KEY,
): OperationHistoryStore {
  return {
    load() {
      const serialized = storage.getItem(key)

      if (serialized === null) {
        return { ok: true, payload: null }
      }

      try {
        return validateOperationHistoryPayload(JSON.parse(serialized) as unknown)
      } catch {
        return {
          ok: false,
          reasonCode: 'invalid-json',
          message: 'Operation history storage did not contain valid JSON.',
        }
      }
    },
    save(payload) {
      storage.setItem(key, JSON.stringify(payload))
    },
    clear() {
      storage.removeItem(key)
    },
  }
}

export function loadOrCreateOperationHistory(
  store: OperationHistoryStore | null,
  documentId: DocumentId,
): OperationHistoryValidationResult {
  if (!store) {
    return {
      ok: true,
      payload: createEmptyOperationHistory(documentId),
    }
  }

  const result = store.load()
  if (!result.ok) {
    return result
  }

  return {
    ok: true,
    payload: result.payload ?? createEmptyOperationHistory(documentId),
  }
}
