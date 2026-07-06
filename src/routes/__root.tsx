import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '../styles.css';

import { CssBaseline, ThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { AuthProvider } from '#/context/AuthContext';
import { queryClient } from '#/queryClient';
import { theme } from '#/theme/theme';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        <Toaster />
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <Outlet />
            <TanStackDevtools
              config={{
                position: 'bottom-right',
              }}
              plugins={[
                {
                  name: 'TanStack Query',
                  render: <ReactQueryDevtoolsPanel />,
                },
                // {
                //   name: 'TanStack Router',
                //   render: <TanStackRouterDevtoolsPanel router={getRouter()} />,
                // },
              ]}
            />
          </QueryClientProvider>
        </AuthProvider>
      </ThemeProvider>
    </LocalizationProvider>
  );
}
