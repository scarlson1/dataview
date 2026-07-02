import { EntityDrawer } from '#/components/EntityDrawer';
import { getEntityForm } from '#/data/entityForms';
import { MONO_FONT } from '#/theme/tokens';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { Download, Plus, RefreshCw, Rows3, Workflow } from 'lucide-react';
import { Suspense, useState } from 'react';
import type { TableDef } from '../../data/tables';
import { TableIcon } from '../TableIcon';
import { DataTab } from './DataTab';
import { SchemaTab } from './SchemaTab';

export type ViewerTab = 'data' | 'schema';

interface TableViewerProps {
  table: TableDef;
  onRefresh: () => void;
}

export const TableViewer = ({ table, onRefresh }: TableViewerProps) => {
  const [tab, setTab] = useState<ViewerTab>('data');
  const [createOpen, setCreateOpen] = useState(false);
  const entityForm = getEntityForm(table.name);
  const FormComponent = entityForm?.component;

  return (
    <>
      {/* page header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '20px',
          mb: '20px',
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Box
              sx={(theme) => ({
                width: 40,
                height: 40,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                backgroundColor: theme.vars.palette.primary.light,
                color: 'primary.main',
              })}
            >
              <TableIcon name={table.icon} size={23} />
            </Box>
            <Typography
              component='h1'
              sx={{
                fontSize: 23,
                fontWeight: 600,
                m: 0,
                letterSpacing: '-0.01em',
                fontFamily: MONO_FONT,
              }}
            >
              {table.label}
            </Typography>
            <Box
              component='span'
              sx={(theme) => ({
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                color: 'text.secondary',
                backgroundColor: theme.vars.palette.hover,
                p: '3px 8px',
                borderRadius: '5px',
              })}
            >
              TABLE
            </Box>
          </Box>
          <Typography
            sx={{
              fontSize: 14,
              color: 'text.secondary',
              mt: '8px',
              maxWidth: 640,
            }}
          >
            {table.description}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          <Button
            variant='outlined'
            onClick={onRefresh}
            startIcon={<RefreshCw size={18} />}
            sx={{ height: 40 }}
          >
            Refresh
          </Button>
          <Button
            variant='outlined'
            startIcon={<Download size={18} />}
            sx={{ height: 40 }}
          >
            Export
          </Button>
          {entityForm && (
            <Button
              variant='contained'
              onClick={() => setCreateOpen(true)}
              startIcon={
                <Plus size={18} color={'var(--variant-containedColor)'} />
              }
              sx={{ height: 40 }}
            >
              New
            </Button>
          )}
        </Box>
      </Box>

      {/* card */}
      <Paper
        elevation={0}
        sx={(theme) => ({
          border: `1px solid ${theme.vars.palette.borderSoft}`,
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        })}
      >
        <Tabs
          value={tab}
          onChange={(_, value: ViewerTab) => setTab(value)}
          sx={(theme) => ({
            borderBottom: `1px solid ${theme.palette.divider}`,
            px: '8px',
          })}
        >
          <Tab
            value='data'
            iconPosition='start'
            icon={<Rows3 size={20} />}
            label='Data'
            sx={{ gap: '8px' }}
          />
          <Tab
            value='schema'
            iconPosition='start'
            icon={<Workflow size={20} />}
            label='Schema'
            sx={{ gap: '8px' }}
          />
        </Tabs>

        {tab === 'data' ? (
          <DataTab table={table} />
        ) : (
          <SchemaTab table={table} />
        )}
      </Paper>

      {entityForm && FormComponent && (
        <EntityDrawer
          open={createOpen}
          title={entityForm.createTitle}
          onClose={() => setCreateOpen(false)}
        >
          <Suspense
            fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={24} />
              </Box>
            }
          >
            <FormComponent
              onSaved={() => {
                setCreateOpen(false);
                onRefresh();
              }}
              onCancel={() => setCreateOpen(false)}
            />
          </Suspense>
        </EntityDrawer>
      )}
    </>
  );
};
