/**
 * The single custom node type for the rater diagram: a small MUI-styled card
 * with the step kind icon, id, summary, and (after a test run) the bound
 * value badge. Status drives color: executed = full color, skipped = dimmed,
 * error = red outline.
 */

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { Handle, Position } from '@xyflow/react';
import {
  Calculator,
  Database,
  Flag,
  GitBranch,
  OctagonX,
  SlidersHorizontal,
  Table2,
} from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { MONO_FONT } from '#/theme/tokens';
import type { RaterFlowNode } from './flowGraph';
import { NODE_WIDTH } from './layout';

const ICONS: Record<RaterFlowNode['data']['stepType'], ReactNode> = {
  inputs: <SlidersHorizontal size={13} />,
  calc: <Calculator size={13} />,
  lookup: <Table2 size={13} />,
  fetch: <Database size={13} />,
  branch: <GitBranch size={13} />,
  decision: <OctagonX size={13} />,
  output: <Flag size={13} />,
};

export const RaterStepNode = memo(
  ({ data }: { data: RaterFlowNode['data'] }) => {
    const dimmed = data.status === 'skipped';
    const isError = data.status === 'error';
    const emphasized = data.stepType === 'output' || data.stepType === 'inputs';
    // A decision that fired (has an outcome badge) is a terminal stop.
    const fired = data.stepType === 'decision' && data.badge !== undefined;

    return (
      <Box
        sx={(t) => ({
          width: NODE_WIDTH,
          borderRadius: 1.5,
          border: `1.5px solid ${
            isError || fired
              ? t.palette.error.main
              : data.status === 'ok'
                ? t.palette.success.main
                : t.palette.divider
          }`,
          backgroundColor: t.vars.palette.background.paper,
          px: 1.25,
          py: 0.75,
          opacity: dimmed ? 0.4 : 1,
          boxShadow: emphasized || fired ? t.shadows[1] : 'none',
        })}
      >
        <Handle
          type='target'
          position={Position.Top}
          style={{ visibility: 'hidden' }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ display: 'inline-flex', color: 'text.secondary' }}>
            {ICONS[data.stepType]}
          </Box>
          <Typography
            sx={{
              fontFamily: data.stepType === 'inputs' ? undefined : MONO_FONT,
              fontSize: 12.5,
              fontWeight: 650,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {data.title}
          </Typography>
          {data.badge !== undefined && (
            <Chip
              label={data.badge}
              size='small'
              color={fired ? 'error' : 'success'}
              variant='outlined'
              sx={{ height: 18, fontSize: 10.5, fontFamily: MONO_FONT }}
            />
          )}
        </Box>
        {data.subtitle && (
          <Typography
            sx={{
              fontSize: 10.5,
              color: 'text.secondary',
              fontFamily: MONO_FONT,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              mt: 0.25,
            }}
          >
            {data.subtitle}
          </Typography>
        )}
        <Handle
          type='source'
          position={Position.Bottom}
          style={{ visibility: 'hidden' }}
        />
      </Box>
    );
  },
);
