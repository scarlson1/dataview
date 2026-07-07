import { useAuth } from '#/context/AuthContext';
import { supabase } from '#/supabaseClient';
import {
  CircularProgress,
  Drawer,
  Fab,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Box from '@mui/material/Box';
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Sidebar } from '../components/dashboard/Sidebar';
import { TopBar } from '../components/dashboard/TopBar';
import { getTable, type TableName } from '../data/tables';

export const Route = createFileRoute('/_dashboard')({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: '/login' });
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { table: tableName } = useParams({ strict: false });
  const activeTable = (tableName ?? '') as TableName;
  const table = getTable(activeTable);

  const handleSelectTable = (name: TableName) =>
    navigate({ to: '/$table', params: { table: name } });
  const handleSignOut = async () => {
    await signOut();
    navigate({ to: '/login' });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: 'background.default',
      }}
    >
      {isMobile ? (
        <Drawer
          anchor='bottom'
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          slotProps={{
            paper: {
              sx: {
                height: '85vh',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                overflow: 'hidden',
              },
            },
          }}
        >
          <Sidebar
            collapsed={false}
            inDrawer
            onNavigate={() => setMobileOpen(false)}
            activeTable={activeTable}
            onSelectTable={handleSelectTable}
            onSignOut={handleSignOut}
          />
        </Drawer>
      ) : (
        <Sidebar
          collapsed={collapsed}
          activeTable={activeTable}
          onSelectTable={handleSelectTable}
          onSignOut={handleSignOut}
        />
      )}

      <Box
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
      >
        <TopBar
          activeName={table?.label ?? ''}
          showMenuButton={!isMobile}
          onToggleSidebar={() =>
            isMobile ? setMobileOpen((o) => !o) : setCollapsed((c) => !c)
          }
        />
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: { xs: '16px 14px 32px', md: '24px 28px 40px' },
          }}
        >
          <Suspense
            fallback={
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 5,
                }}
              >
                <CircularProgress size={20} />
              </Box>
            }
          >
            <Outlet />
          </Suspense>
        </Box>
      </Box>

      {isMobile && (
        <Fab
          color='primary'
          aria-label='Open menu'
          onClick={() => setMobileOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: (t) => t.zIndex.speedDial,
          }}
        >
          <Menu size={20} />
        </Fab>
      )}
    </Box>
  );
}
