import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import React from 'react';

// Mock Firebase modules
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
    return () => {}; // Unsubscribe function
  }),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

// Mock components
vi.mock('./components/Login', () => ({
  default: () => <div data-testid="login-component">Login Component</div>,
}));

describe('App', () => {
  it('renders Login component when not authenticated', () => {
    render(<App />);
    expect(screen.getByTestId('login-component')).toBeInTheDocument();
  });
});
