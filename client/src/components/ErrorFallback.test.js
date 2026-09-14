import React from 'react';
import { render, screen } from '@testing-library/react';
import Sentry from '../config/sentry.js';
import ErrorFallback from './ErrorFallback';

// Phase 17 DoD: "A React error boundary reports client crashes instead of a
// blank screen" — this renders the exact wrapper index.js uses
// (Sentry.ErrorBoundary + ErrorFallback) around a component that always
// throws, and asserts the fallback UI appears rather than the tree
// unmounting to nothing.
const ThrowsOnRender = () => {
  throw new Error('Simulated render crash');
};

// React logs the caught error to the console by default (via
// componentDidCatch) — expected noise for this specific test, silenced so
// the test output stays readable.
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  console.error.mockRestore();
});

describe('Sentry.ErrorBoundary + ErrorFallback', () => {
  it('renders the fallback UI instead of a blank screen when a child throws', () => {
    render(
      <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
        <ThrowsOnRender />
      </Sentry.ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload the page/i })).toBeInTheDocument();
  });
});
