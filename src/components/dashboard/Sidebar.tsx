import { useTheme } from '@mui/material';
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
  Network,
  PiggyBank,
  Settings,
  Stamp,
  TrendingUp,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
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
}: SidebarProps) => {
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TABLE_GROUPS.map((g) => [g.id, false])),
  );

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <Box
      component='aside'
      sx={(theme) => ({
        width: collapsed ? SIDEBAR_CLOSED : SIDEBAR_OPEN,
        flexShrink: 0,
        backgroundColor: 'background.paper',
        borderRight: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      })}
    >
      {/* brand */}
      <Box
        sx={(theme) => ({
          height: 64,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          px: '17px',
          borderBottom: `1px solid ${theme.vars.palette.borderSoft}`,
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
                onSelect={onSelectTable}
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
                          onSelect={onSelectTable}
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
          label='Workflow'
          collapsed={collapsed}
          onClick={() => navigate({ to: '/workflow' })}
        />
        <FooterItem
          icon={<Layers size={20} />}
          label='Subscriptions'
          collapsed={collapsed}
          onClick={() => navigate({ to: '/subscriptions' })}
        />
        <FooterItem
          icon={<PiggyBank size={20} />}
          label='UEP Reserve'
          collapsed={collapsed}
          onClick={() => navigate({ to: '/uep' })}
        />
        <FooterItem
          icon={<TrendingUp size={20} />}
          label='Budget'
          collapsed={collapsed}
          onClick={() => navigate({ to: '/budget' })}
        />
        <FooterItem
          icon={<Stamp size={20} />}
          label='Stamp'
          collapsed={collapsed}
          onClick={() => navigate({ to: '/stamp' })}
        />
        <FooterItem
          icon={<FileDown size={20} />}
          label='Exports'
          collapsed={collapsed}
          onClick={() => navigate({ to: '/exports' })}
        />
        <FooterItem
          icon={<Network size={20} />}
          label='Connections'
          collapsed={collapsed}
        />
        <FooterItem
          icon={<Settings size={20} />}
          label='Settings'
          collapsed={collapsed}
        />
        <Divider sx={{ m: '8px 4px' }} />
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
          >
            AL
          </Avatar>
          {!collapsed && (
            <>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Ada Lovelace
                </Typography>
                <Typography
                  sx={{
                    fontSize: 11.5,
                    color: 'text.secondary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  ada@acme.io
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
      </Box>
    </Box>
  );
};
