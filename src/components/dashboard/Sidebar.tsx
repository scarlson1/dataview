import { Skeleton, useTheme } from '@mui/material';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useNavigate } from '@tanstack/react-router';
import {
  ChevronDown,
  Database,
  FileDown,
  Layers,
  LogOut,
  Stamp,
  TrendingUp,
  Users,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '#/context/AuthContext';
import {
  formatTableLabel,
  TABLE_GROUPS,
  TABLES,
  type TableName,
} from '../../data/tables';
import { TableIcon } from '../TableIcon';

const SIDEBAR_OPEN = 260;
const SIDEBAR_CLOSED = 68;

interface SidebarProps {
  collapsed: boolean;
  activeTable: TableName;
  onSelectTable: (name: TableName) => void;
  onSignOut: () => void;
  /** When rendered inside the mobile bottom-sheet Drawer. */
  inDrawer?: boolean;
  /** Called after any navigation so the mobile Drawer can close itself. */
  onNavigate?: () => void;
}

const FooterItem = ({
  icon,
  label,
  collapsed,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  onClick?: () => void;
}) => (
  <Tooltip title={collapsed ? label : ''} placement='right'>
    <Box
      onClick={onClick}
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '13px',
        height: 40,
        px: '12px',
        borderRadius: 1,
        cursor: 'pointer',
        color: 'text.secondary',
        whiteSpace: 'nowrap',
        '&:hover': { backgroundColor: theme.vars.palette.hover },
      })}
    >
      <Box sx={{ display: 'flex', flexShrink: 0 }}>{icon}</Box>
      {!collapsed && (
        <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{label}</Typography>
      )}
    </Box>
  </Tooltip>
);

const TableRow = ({
  name,
  active,
  collapsed,
  onSelect,
}: {
  name: TableName;
  active: boolean;
  collapsed: boolean;
  onSelect: (name: TableName) => void;
}) => {
  const theme = useTheme();
  const table = TABLES[name];
  const label = formatTableLabel(table.label);

  return (
    <Tooltip title={collapsed ? label : ''} placement='right'>
      <Box
        onClick={() => onSelect(name)}
        sx={(theme) => ({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          height: 40,
          px: 1.5,
          mb: 0.5,
          borderRadius: 1,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          color: active ? 'primary.main' : 'text.secondary',
          backgroundColor: active
            ? theme.vars.palette.primary.light
            : 'transparent',
          '&:hover': {
            backgroundColor: active
              ? theme.vars.palette.primary.light
              : theme.vars.palette.hover,
          },
        })}
      >
        <Box sx={{ display: 'flex', flexShrink: 0 }}>
          <TableIcon
            name={table.icon}
            size={20}
            color={
              active
                ? theme.vars.palette.primary.main
                : theme.vars.palette.text.secondary
            }
          />
        </Box>
        {!collapsed && (
          <Typography
            sx={{
              flex: 1,
              fontSize: 14,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};

export const Sidebar = ({
  collapsed,
  activeTable,
  onSelectTable,
  onSignOut,
  inDrawer = false,
  onNavigate,
}: SidebarProps) => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TABLE_GROUPS.map((g) => [g.id, false])),
  );

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  // Run a navigation and then let the mobile Drawer close itself.
  const go = (fn: () => void) => {
    fn();
    onNavigate?.();
  };

  return (
    <Box
      component='aside'
      sx={(theme) => ({
        width: inDrawer ? '100%' : collapsed ? SIDEBAR_CLOSED : SIDEBAR_OPEN,
        height: inDrawer ? '100%' : undefined,
        flexShrink: 0,
        backgroundColor: 'background.paper',
        borderRight: inDrawer ? 'none' : `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      })}
    >
      {/* brand */}
      <Box
        onClick={() => go(() => navigate({ to: '/' }))}
        sx={(theme) => ({
          height: 64,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          px: '17px',
          cursor: 'pointer',
          borderBottom: `1px solid ${theme.vars.palette.borderSoft}`,
          '&:hover': { backgroundColor: theme.vars.palette.hover },
        })}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            flexShrink: 0,
            borderRadius: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
          }}
        >
          <Database size={20} />
        </Box>
        {!collapsed && (
          <Typography
            sx={{
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: '-0.015em',
              whiteSpace: 'nowrap',
            }}
          >
            Dataview
          </Typography>
        )}
      </Box>

      {/* table list */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          px: 1,
          py: 1.5,
          // p: '12px 10px',
        }}
      >
        {collapsed
          ? TABLE_GROUPS.flatMap((group) => group.tables).map((name) => (
              <TableRow
                key={name}
                name={name}
                active={name === activeTable}
                collapsed
                onSelect={(name) => go(() => onSelectTable(name))}
              />
            ))
          : TABLE_GROUPS.map((group) => {
              const open = openGroups[group.id];
              return (
                <Box key={group.id} sx={{ mb: 0.5 }}>
                  <Box
                    onClick={() => toggleGroup(group.id)}
                    sx={(theme) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      borderRadius: 1,
                      p: '6px 12px 6px 8px',
                      color: 'text.disabled',
                      userSelect: 'none',
                      '&:hover': { backgroundColor: theme.vars.palette.hover },
                    })}
                  >
                    <ChevronDown
                      size={14}
                      style={{
                        flexShrink: 0,
                        transition: 'transform 0.15s ease',
                        transform: open ? 'none' : 'rotate(-90deg)',
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.09em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {group.label}
                    </Typography>
                  </Box>
                  <Collapse in={open} timeout='auto' unmountOnExit>
                    <Box sx={{ mt: 0.5 }}>
                      {group.tables.map((name) => (
                        <TableRow
                          key={name}
                          name={name}
                          active={name === activeTable}
                          collapsed={false}
                          onSelect={(name) => go(() => onSelectTable(name))}
                        />
                      ))}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
      </Box>

      {/* footer */}
      <Box
        sx={(theme) => ({
          flexShrink: 0,
          p: '8px 10px 10px',
          borderTop: `1px solid ${theme.vars.palette.borderSoft}`,
        })}
      >
        <FooterItem
          icon={<Workflow size={20} />}
          label='Workflows'
          collapsed={collapsed}
          onClick={() => go(() => navigate({ to: '/workflow' }))}
        />
        <FooterItem
          icon={<Layers size={20} />}
          label='Subscriptions'
          collapsed={collapsed}
          onClick={() => go(() => navigate({ to: '/subscriptions' }))}
        />
        <FooterItem
          icon={<TrendingUp size={20} />}
          label='Budget'
          collapsed={collapsed}
          onClick={() => go(() => navigate({ to: '/budget' }))}
        />
        <FooterItem
          icon={<Stamp size={20} />}
          label='Stamp'
          collapsed={collapsed}
          onClick={() => go(() => navigate({ to: '/stamp' }))}
        />
        <FooterItem
          icon={<FileDown size={20} />}
          label='Exports'
          collapsed={collapsed}
          onClick={() => go(() => navigate({ to: '/exports' }))}
        />
        {role === 'admin' && (
          <FooterItem
            icon={<Users size={20} />}
            label='Team'
            collapsed={collapsed}
            onClick={() => go(() => navigate({ to: '/users' }))}
          />
        )}
        {/* <FooterItem
          icon={<Network size={20} />}
          label='Connections'
          collapsed={collapsed}
        />
        <FooterItem
          icon={<Settings size={20} />}
          label='Settings'
          collapsed={collapsed}
        /> */}
        <Divider sx={{ m: '8px 4px' }} />
        <UserDetails collapsed={collapsed} onSignOut={onSignOut} />
      </Box>
    </Box>
  );
};

function UserDetails({
  collapsed,
  onSignOut,
}: {
  collapsed: boolean;
  onSignOut: () => void;
}) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          p: '6px 8px',
          whiteSpace: 'nowrap',
        }}
      >
        <Skeleton variant='circular' width={32} height={32} />
        {!collapsed && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant='text' sx={{ fontSize: 13, p: 1 }} />
            <Skeleton variant='text' sx={{ fontSize: 11, p: 1 }} />
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '11px',
        p: '6px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      <Avatar
        sx={(theme) => ({
          width: 32,
          height: 32,
          flexShrink: 0,
          fontSize: 13,
          fontWeight: 600,
          backgroundColor: theme.vars.palette.primary.light,
          color: 'primary.main',
        })}
      />
      {/* AL */}
      {/* </Avatar> */}
      {!collapsed && (
        <>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                John Doe
              </Typography>
              {role && (
                <Box
                  component='span'
                  sx={(theme) => ({
                    flexShrink: 0,
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                    px: '6px',
                    py: '3px',
                    borderRadius: '4px',
                    color: 'primary.main',
                    backgroundColor: theme.vars.palette.primary.light,
                  })}
                >
                  {role}
                </Box>
              )}
            </Box>
            <Typography
              sx={{
                fontSize: 11,
                color: 'text.secondary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.email || ''}
            </Typography>
          </Box>
          <Tooltip title='Sign out' placement='top'>
            <IconButton onClick={onSignOut} size='small'>
              <LogOut size={19} />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  );
}
