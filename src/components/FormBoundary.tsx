/**
 * Wraps a lazily-loaded entity form in an ErrorBoundary + Suspense so a
 * chunk-load failure or a bad module export (e.g. a missing default export)
 * degrades to an inline error with a retry, instead of crashing the drawer.
 */
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { type ReactNode, Suspense } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

const LoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
    <CircularProgress size={24} />
  </Box>
);

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => (
  <Box sx={{ p: 3 }}>
    <Alert
      severity='error'
      action={
        <Button color='inherit' size='small' onClick={resetErrorBoundary}>
          Retry
        </Button>
      }
    >
      Couldn't load this form.
      {error instanceof Error && error.message ? ` (${error.message})` : ''}
    </Alert>
  </Box>
);

interface FormBoundaryProps {
  children: ReactNode;
}

export const FormBoundary = ({ children }: FormBoundaryProps) => (
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
  </ErrorBoundary>
);
