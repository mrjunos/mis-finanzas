import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import React from 'react';

// ─────────────────────────────────────────────────
// Mock Firebase modules
// ─────────────────────────────────────────────────
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback(null); // Simulate no user logged in
    return () => { }; // Unsubscribe function
  }),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  setDoc: vi.fn(() => Promise.resolve()),
  addDoc: vi.fn(() => Promise.resolve({ id: 'test-id' })),
  deleteDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  onSnapshot: vi.fn(() => () => {}),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
  Timestamp: { now: vi.fn(() => ({ toDate: () => new Date() })), fromDate: vi.fn() },
  writeBatch: vi.fn(() => ({ set: vi.fn(), delete: vi.fn(), commit: vi.fn(() => Promise.resolve()) })),
}));

// ─────────────────────────────────────────────────
// Mock child components to isolate App behavior
// ─────────────────────────────────────────────────
vi.mock('./shared/components/Login', () => ({
  default: () => <div data-testid="login-component">Login Component</div>,
}));

vi.mock('./shared/components/Sidebar', () => ({
  default: () => <div data-testid="sidebar-component">Sidebar</div>,
}));

vi.mock('./shared/components/Header', () => ({
  default: () => <div data-testid="header-component">Header</div>,
}));

vi.mock('./shared/components/HomeScreen', () => ({
  default: () => <div data-testid="home-component">Home</div>,
}));

vi.mock('./components/Settings', () => ({
  default: () => <div data-testid="settings-component">Settings</div>,
}));

// ─────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────
describe('App', () => {
  it('renders Login component when not authenticated', () => {
    render(<App />);
    expect(screen.getByTestId('login-component')).toBeInTheDocument();
  });

  it('does not render Dashboard when not authenticated', () => {
    render(<App />);
    expect(screen.queryByTestId('dashboard-component')).not.toBeInTheDocument();
  });

  it('does not render Sidebar when not authenticated', () => {
    render(<App />);
    expect(screen.queryByTestId('sidebar-component')).not.toBeInTheDocument();
  });
});
