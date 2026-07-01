import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '../styles.css';

import { queryClient } from '#/queryClient';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { Toaster } from 'sonner';
import { ColorModeProvider } from '../theme/ColorModeContext';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ColorModeProvider>
      <Toaster />
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>

      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </ColorModeProvider>
  );
}
