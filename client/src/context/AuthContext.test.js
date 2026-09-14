import React, { useContext, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthContext, { AuthProvider } from './AuthContext';
import api, { setAccessToken } from '../services/api';

// Phase 14: api.js wraps a real axios instance — mock the whole module so
// no test here ever makes a real network call. setAccessToken is mocked too
// since it's just an in-memory setter with no state a test needs to inspect.
jest.mock('../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn(), put: jest.fn(), patch: jest.fn() },
  setAccessToken: jest.fn(),
}));

// A minimal consumer so the test can drive AuthContext's methods and assert
// on its exposed state, without depending on any real page component. Mirrors
// how AuthScreen.jsx itself calls login() — catch the rejection, show it.
const TestConsumer = () => {
  const { user, loading, login, logout } = useContext(AuthContext);
  const [error, setError] = useState('');
  const handleLogin = async () => {
    setError('');
    try {
      await login('a@b.com', 'password123');
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.name : 'none'}</span>
      <span data-testid="error">{error}</span>
      <button onClick={handleLogin}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
};

const renderWithProvider = () =>
  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  // The bootstrap effect always fires on mount and tries a silent refresh —
  // reject it by default (the "no existing session" case) so each test
  // starts from a known logged-out state unless it overrides this.
  api.post.mockImplementation((url) => {
    if (url === '/auth/refresh') return Promise.reject(new Error('no session'));
    return Promise.reject(new Error(`unexpected POST ${url}`));
  });
});

describe('AuthContext', () => {
  it('starts logged out once the silent-refresh bootstrap fails', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('login() populates the user from the response', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    api.post.mockImplementation((url, body) => {
      if (url === '/auth/login') {
        return Promise.resolve({
          data: { _id: '1', name: 'Ada Lovelace', email: body.email, accessToken: 'tok_123' },
        });
      }
      return Promise.reject(new Error(`unexpected POST ${url}`));
    });

    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Ada Lovelace'));
    expect(setAccessToken).toHaveBeenCalledWith('tok_123');
  });

  it('logout() clears the user and the in-memory access token', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    api.post.mockImplementation((url, body) => {
      if (url === '/auth/login') {
        return Promise.resolve({
          data: { _id: '1', name: 'Ada Lovelace', email: body.email, accessToken: 'tok_123' },
        });
      }
      if (url === '/auth/logout') return Promise.resolve({ data: { message: 'Logged out.' } });
      return Promise.reject(new Error(`unexpected POST ${url}`));
    });

    await userEvent.click(screen.getByText('Login'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Ada Lovelace'));

    await userEvent.click(screen.getByText('Logout'));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
    expect(setAccessToken).toHaveBeenLastCalledWith(null);
  });

  it('login() surfaces the server error message and leaves the user logged out', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    api.post.mockImplementation((url) => {
      if (url === '/auth/login') {
        const error = new Error('Request failed');
        error.response = { data: { message: 'Invalid email or password' } };
        return Promise.reject(error);
      }
      return Promise.reject(new Error(`unexpected POST ${url}`));
    });

    await userEvent.click(screen.getByText('Login'));

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('Invalid email or password')
    );
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });
});
