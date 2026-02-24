import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ─────────────────────────────────────────────────
// Global Firebase mocks
// These prevent Firebase SDK initialization during tests.
// Components and contexts transitively import firebase modules
// which call initializeApp() at module load time, causing hangs.
// ─────────────────────────────────────────────────

vi.mock('./firebase', () => ({
    db: {},
    auth: {},
    googleProvider: {},
}));

vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({})),
    GoogleAuthProvider: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn((auth, callback) => {
        callback(null);
        return () => { };
    }),
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn(),
    onSnapshot: vi.fn(() => vi.fn()),
    addDoc: vi.fn(),
    doc: vi.fn(() => 'mock-doc-ref'),
    setDoc: vi.fn(),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => null })),
    Timestamp: {
        now: vi.fn(() => ({ seconds: 1234567890 })),
        fromDate: vi.fn((date) => ({ seconds: Math.floor(date.getTime() / 1000) })),
    },
    deleteDoc: vi.fn(),
    updateDoc: vi.fn(),
    writeBatch: vi.fn(() => ({
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
    })),
}));
