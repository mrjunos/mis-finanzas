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
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

// ─────────────────────────────────────────────────
// Mock child components to isolate App behavior
// ─────────────────────────────────────────────────
vi.mock('./components/Login', () => ({
  default: () => <div data-testid="login-component">Login Component</div>,
}));

vi.mock('./components/Dashboard', () => ({
  default: () => <div data-testid="dashboard-component">Dashboard</div>,
}));

vi.mock('./components/Sidebar', () => ({
  default: () => <div data-testid="sidebar-component">Sidebar</div>,
}));

vi.mock('./components/Header', () => ({
  default: () => <div data-testid="header-component">Header</div>,
}));

vi.mock('./components/Transactions', () => ({
  default: () => <div data-testid="transactions-component">Transactions</div>,
}));

vi.mock('./components/Settings', () => ({
  default: () => <div data-testid="settings-component">Settings</div>,
}));

vi.mock('./components/Presupuestos', () => ({
  default: () => <div data-testid="presupuestos-component">Presupuestos</div>,
}));

vi.mock('./components/Insights', () => ({
  default: () => <div data-testid="insights-component">Insights</div>,
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
