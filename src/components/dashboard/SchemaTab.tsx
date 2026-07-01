import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { KeyRound } from 'lucide-react';
import type { TableDef } from '../../data/tables';
import { keyTone, MONO_FONT } from '../../theme/tokens';
import { StatusChip } from '../StatusChip';

const CELL_PAD = '8px 16px';

const HEADERS = ['Column', 'Type', 'Nullable', 'Key', 'Default'];

export const SchemaTab = ({ table }: { table: TableDef }) => (
  <>
    <Box
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        p: '12px 16px',
        borderBottom: `1px solid ${theme.vars.palette.borderSoft}`,
        ...theme.applyStyles('dark', {
          borderBottom: `1px solid ${theme.vars.palette.borderSoft}`,
        }),
      })}
    >
      <Box sx={{ display: 'flex', color: 'text.secondary' }}>
        <KeyRound size={19} />
      </Box>
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
        <Box
          component='span'
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            fontFamily: MONO_FONT,
          }}
        >
          {table.columns.length}
        </Box>{' '}
        columns ·{' '}
        <Box component='span' sx={{ fontFamily: MONO_FONT }}>
          public.{table.label}
        </Box>
      </Typography>
    </Box>

    <Box sx={{ overflowX: 'auto' }}>
      <Table sx={{ minWidth: 640 }}>
        <TableHead>
          <TableRow>
            {HEADERS.map((h) => (
              <TableCell key={h}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {table.columns.map((column) => (
            <TableRow
              key={column.field}
              sx={(theme) => ({
                '&:hover': { backgroundColor: theme.vars.palette.primaryHover },
                '&:last-of-type td': { borderBottom: 0 },
              })}
            >
              <TableCell
                sx={{
                  p: CELL_PAD,
                  whiteSpace: 'nowrap',
                  fontFamily: MONO_FONT,
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: 'text.primary',
                }}
              >
                {column.field}
              </TableCell>
              <TableCell
                sx={{
                  p: CELL_PAD,
                  whiteSpace: 'nowrap',
                  fontFamily: MONO_FONT,
                  fontSize: 13,
                  color: 'primary.main',
                }}
              >
                {column.type}
              </TableCell>
              <TableCell
                sx={{
                  p: CELL_PAD,
                  whiteSpace: 'nowrap',
                  fontSize: 13,
                  color: column.nullable ? 'text.secondary' : 'text.primary',
                }}
              >
                {column.nullable ? 'NULL' : 'NOT NULL'}
              </TableCell>
              <TableCell sx={{ p: CELL_PAD, whiteSpace: 'nowrap' }}>
                {column.key ? (
                  <StatusChip
                    label={column.key}
                    tone={keyTone(column.key)}
                    variant='badge'
                  />
                ) : (
                  <Box component='span' sx={{ color: 'text.disabled' }}>
                    —
                  </Box>
                )}
              </TableCell>
              <TableCell
                sx={{
                  p: CELL_PAD,
                  whiteSpace: 'nowrap',
                  fontFamily: MONO_FONT,
                  fontSize: 13,
                  color: column.def ? 'text.primary' : 'text.disabled',
                }}
              >
                {column.def ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  </>
);
