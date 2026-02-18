import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import type { Document } from '../types';
import { createFileStorage, STORAGE_FILES, isTauri } from '../lib/fileStorage';
import { generateId } from '../utils/idUtils';

// Storage limits to prevent overflow
const MAX_DOCUMENT_SIZE = 500_000; // 500 KB per document (TipTap JSON can be large)
const MAX_TOTAL_DOCUMENTS_SIZE = 8_000_000; // 8 MB total for all documents
const MAX_DOCUMENTS_COUNT = 200; // Maximum number of documents

// Error types for size validation
export class DocumentSizeError extends Error {
  constructor(message: string, public readonly type: 'single' | 'total' | 'count') {
    super(message);
    this.name = 'DocumentSizeError';
  }
}

// Utility to estimate document size
function estimateDocumentSize(doc: Partial<Document>): number {
  return JSON.stringify(doc).length;
}

interface DocumentStore {
  documents: Document[];

  // CRUD Actions
  addDocument: (
    doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>
  ) => string;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  deleteDocument: (id: string) => void;

  // Query helpers
  getDocumentsByClient: (clientId: string) => Document[];
  getDocumentsByTask: (taskId: string) => Document[];
  getDocumentById: (id: string) => Document | undefined;
  getStandaloneDocuments: (clientId: string) => Document[];
}

// State-Typ fuer den Storage-Adapter
interface DocumentStoreState {
  documents: Document[];
}

// Erstelle den File-Storage-Adapter fuer Tauri
const fileStorage = createFileStorage<DocumentStoreState>(STORAGE_FILES.documents);

// Verwende File-Storage in Tauri, ansonsten localStorage als Fallback
const storage: StateStorage = isTauri()
  ? fileStorage
  : {
      getItem: (name) => {
        const value = localStorage.getItem(name);
        return value ? Promise.resolve(value) : Promise.resolve(null);
      },
      setItem: (name, value) => {
        localStorage.setItem(name, value);
        return Promise.resolve();
      },
      removeItem: (name) => {
        localStorage.removeItem(name);
        return Promise.resolve();
      },
    };

export const useDocumentStore = create<DocumentStore>()(
  persist(
    (set, get) => ({
      documents: [],

      addDocument: (docData) => {
        const state = get();

        // Check document count limit
        if (state.documents.length >= MAX_DOCUMENTS_COUNT) {
          throw new DocumentSizeError(
            `Maximale Anzahl von ${MAX_DOCUMENTS_COUNT} Dokumenten erreicht. Bitte lösche alte Dokumente.`,
            'count'
          );
        }

        const now = new Date().toISOString();
        const id = generateId();
        const newDoc: Document = {
          ...docData,
          id,
          createdAt: now,
          updatedAt: now,
        };

        // Check single document size
        const docSize = estimateDocumentSize(newDoc);
        if (docSize > MAX_DOCUMENT_SIZE) {
          throw new DocumentSizeError(
            `Dokument ist zu groß (${Math.round(docSize / 1000)} KB). Maximum: ${MAX_DOCUMENT_SIZE / 1000} KB.`,
            'single'
          );
        }

        // Check total size
        const currentTotalSize = state.documents.reduce(
          (acc, doc) => acc + estimateDocumentSize(doc),
          0
        );
        if (currentTotalSize + docSize > MAX_TOTAL_DOCUMENTS_SIZE) {
          throw new DocumentSizeError(
            `Speicherlimit erreicht. Bitte lösche alte Dokumente um Platz zu schaffen.`,
            'total'
          );
        }

        set((state) => ({ documents: [...state.documents, newDoc] }));
        return id;
      },

      updateDocument: (id, updates) => {
        const state = get();
        const existingDoc = state.documents.find((doc) => doc.id === id);

        if (existingDoc && updates.content !== undefined) {
          // Check if update would exceed single document limit
          const updatedDoc = { ...existingDoc, ...updates };
          const newSize = estimateDocumentSize(updatedDoc);

          if (newSize > MAX_DOCUMENT_SIZE) {
            throw new DocumentSizeError(
              `Dokument ist zu groß (${Math.round(newSize / 1000)} KB). Maximum: ${MAX_DOCUMENT_SIZE / 1000} KB. Bitte kürze den Inhalt.`,
              'single'
            );
          }

          // Check total size (excluding current doc, adding new size)
          const otherDocsSize = state.documents
            .filter((doc) => doc.id !== id)
            .reduce((acc, doc) => acc + estimateDocumentSize(doc), 0);

          if (otherDocsSize + newSize > MAX_TOTAL_DOCUMENTS_SIZE) {
            throw new DocumentSizeError(
              `Speicherlimit erreicht. Bitte kürze den Inhalt oder lösche andere Dokumente.`,
              'total'
            );
          }
        }

        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id
              ? { ...doc, ...updates, updatedAt: new Date().toISOString() }
              : doc
          ),
        }));
      },

      deleteDocument: (id) => {
        set((state) => ({
          documents: state.documents.filter((doc) => doc.id !== id),
        }));
      },

      getDocumentsByClient: (clientId) => {
        return get().documents.filter((doc) => doc.clientId === clientId);
      },

      getDocumentsByTask: (taskId) => {
        return get().documents.filter((doc) => doc.taskId === taskId);
      },

      getDocumentById: (id) => {
        return get().documents.find((doc) => doc.id === id);
      },

      getStandaloneDocuments: (clientId) => {
        return get().documents.filter(
          (doc) => doc.clientId === clientId && !doc.taskId
        );
      },
    }),
    {
      name: 'tally-documents',
      storage: createJSONStorage(() => storage),
    }
  )
);
