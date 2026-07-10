/**
 * Ordered list of step cards for one step list (the root, a branch case, or
 * an else block — recursion happens through BranchStepEditor). Each card
 * shows the step's type, binding id, and a collapsible editor body; cards
 * reorder within their own list via up/down buttons.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  ChevronDown,
  ChevronRight,
  Database,
  Flag,
  GitBranch,
  OctagonX,
  Plus,
  Table2,
  Trash2,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { MONO_FONT } from '#/theme/tokens';
import type { RaterDefinition, RaterStep } from '#/types/raters';
import {
  bindingsBefore,
  pathKey,
  referencingSteps,
  type StepPath,
} from './definitionUtils';
import { BranchStepEditor } from './steps/BranchStepEditor';
import { CalcStepEditor } from './steps/CalcStepEditor';
import { DecisionStepEditor } from './steps/DecisionStepEditor';
import { FetchStepEditor } from './steps/FetchStepEditor';
import { LookupStepEditor } from './steps/LookupStepEditor';
import { OutputStepEditor } from './steps/OutputStepEditor';

export interface StepListEditorHandlers {
  onReplace: (path: StepPath, step: RaterStep) => void;
  onRemove: (path: StepPath, step: RaterStep) => void;
  onMove: (path: StepPath, delta: -1 | 1) => void;
  onAdd: (parentPath: StepPath, type: RaterStep['type']) => void;
  /** Step ids with a validation error (drives the red chip). */
  errorStepIds: Set<string>;
}

interface StepListEditorProps {
  definition: RaterDefinition;
  parentPath: StepPath;
  steps: RaterStep[];
  handlers: StepListEditorHandlers;
  nested?: boolean;
}

const STEP_META: Record<RaterStep['type'], { label: string; icon: ReactNode }> =
  {
    calc: { label: 'Calc', icon: <Calculator size={14} /> },
    lookup: { label: 'Lookup', icon: <Table2 size={14} /> },
    fetch: { label: 'Fetch', icon: <Database size={14} /> },
    branch: { label: 'Branch', icon: <GitBranch size={14} /> },
    decision: { label: 'Decision', icon: <OctagonX size={14} /> },
    output: { label: 'Output', icon: <Flag size={14} /> },
  };

const ADDABLE: RaterStep['type'][] = [
  'calc',
  'lookup',
  'fetch',
  'branch',
  'decision',
  'output',
];

const summarize = (step: RaterStep): string => {
  switch (step.type) {
    case 'calc':
    case 'output':
      return step.expr || '—';
    case 'lookup':
      return step.source === 'ref'
        ? (step.tableName ?? 'shared table')
        : `${step.rows.length} row${step.rows.length === 1 ? '' : 's'} × ${step.columns.length} col`;
    case 'fetch':
      return step.source === 'db'
        ? step.table || 'db query'
        : step.url || 'external API';
    case 'branch':
      return `${step.cases.length} case${step.cases.length === 1 ? '' : 's'}${step.else?.length ? ' + else' : ''}`;
    case 'decision':
      return `${step.outcome}${step.when ? ` when ${step.when}` : ' (always)'}`;
  }
};

const ID_RE = /^[a-z][a-z0-9_]*$/;

export const StepListEditor = ({
  definition,
  parentPath,
  steps,
  handlers,
  nested,
}: StepListEditorProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Stack spacing={1}>
      {steps.map((step, index) => {
        const path = [...parentPath, index];
        const key = pathKey(path);
        const isOpen = expanded.has(key);
        const available = [
          ...definition.inputs.map((i) => `inputs.${i.name}`),
          ...bindingsBefore(definition, path),
        ];
        const hasError = handlers.errorStepIds.has(step.id);
        const badId = !ID_RE.test(step.id);

        return (
          <Paper
            key={key}
            variant='outlined'
            sx={(t) => ({
              borderRadius: 1.5,
              borderColor: hasError ? t.palette.error.main : undefined,
            })}
          >
            {/* card header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.25,
                py: 0.75,
                cursor: 'pointer',
              }}
              onClick={() => toggle(key)}
            >
              {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              <Chip
                icon={STEP_META[step.type].icon as never}
                label={STEP_META[step.type].label}
                size='small'
                variant='outlined'
                sx={{
                  fontSize: 11,
                  height: 22,
                  '& .MuiChip-icon': { ml: 0.5 },
                }}
              />
              <Typography
                sx={{ fontFamily: MONO_FONT, fontSize: 13, fontWeight: 600 }}
              >
                {step.id}
              </Typography>
              <Typography
                sx={{
                  fontSize: 12,
                  color: 'text.secondary',
                  fontFamily: MONO_FONT,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {step.label || summarize(step)}
              </Typography>
              <Stack
                direction='row'
                spacing={0}
                onClick={(e) => e.stopPropagation()}
              >
                <IconButton
                  size='small'
                  disabled={index === 0}
                  onClick={() => handlers.onMove(path, -1)}
                >
                  <ArrowUp size={14} />
                </IconButton>
                <IconButton
                  size='small'
                  disabled={index === steps.length - 1}
                  onClick={() => handlers.onMove(path, 1)}
                >
                  <ArrowDown size={14} />
                </IconButton>
                <IconButton
                  size='small'
                  onClick={() => {
                    const refs = referencingSteps(definition, step.id).filter(
                      (id) => id !== step.id,
                    );
                    if (
                      refs.length &&
                      !window.confirm(
                        `'${step.id}' is referenced by: ${refs.join(', ')}. Delete anyway?`,
                      )
                    ) {
                      return;
                    }
                    handlers.onRemove(path, step);
                  }}
                >
                  <Trash2 size={14} />
                </IconButton>
              </Stack>
            </Box>

            {/* card body */}
            <Collapse in={isOpen} timeout='auto' unmountOnExit>
              <Box
                sx={(t) => ({
                  p: 1.5,
                  pt: 1,
                  borderTop: `1px solid ${t.palette.divider}`,
                })}
              >
                <Stack spacing={1.5}>
                  <Stack direction='row' spacing={1.5}>
                    <TextField
                      label='Step id (binding name)'
                      value={step.id}
                      onChange={(e) =>
                        handlers.onReplace(path, {
                          ...step,
                          id: e.target.value,
                        })
                      }
                      size='small'
                      error={badId}
                      helperText={
                        badId ? 'snake_case: letters, digits, _' : undefined
                      }
                      slotProps={{
                        input: { sx: { fontFamily: MONO_FONT, fontSize: 13 } },
                      }}
                      sx={{ width: 240 }}
                    />
                    {step.type !== 'output' && (
                      <TextField
                        label='Label (optional)'
                        value={step.label ?? ''}
                        onChange={(e) =>
                          handlers.onReplace(path, {
                            ...step,
                            label: e.target.value || undefined,
                          })
                        }
                        size='small'
                        sx={{ flex: 1 }}
                      />
                    )}
                  </Stack>

                  {step.type === 'calc' && (
                    <CalcStepEditor
                      step={step}
                      onChange={(s) => handlers.onReplace(path, s)}
                      availableBindings={available}
                    />
                  )}
                  {step.type === 'lookup' && (
                    <LookupStepEditor
                      step={step}
                      onChange={(s) => handlers.onReplace(path, s)}
                      availableBindings={available}
                    />
                  )}
                  {step.type === 'fetch' && (
                    <FetchStepEditor
                      step={step}
                      onChange={(s) => handlers.onReplace(path, s)}
                      availableBindings={available}
                    />
                  )}
                  {step.type === 'branch' && (
                    <BranchStepEditor
                      step={step}
                      onChange={(s) => handlers.onReplace(path, s)}
                      availableBindings={available}
                      definition={definition}
                      path={path}
                      handlers={handlers}
                    />
                  )}
                  {step.type === 'decision' && (
                    <DecisionStepEditor
                      step={step}
                      onChange={(s) => handlers.onReplace(path, s)}
                      availableBindings={available}
                    />
                  )}
                  {step.type === 'output' && (
                    <OutputStepEditor
                      step={step}
                      onChange={(s) => handlers.onReplace(path, s)}
                      availableBindings={available}
                    />
                  )}
                </Stack>
              </Box>
            </Collapse>
          </Paper>
        );
      })}

      <Box>
        <Button
          size={nested ? 'small' : 'medium'}
          startIcon={<Plus size={15} />}
          onClick={(e) => setAddAnchor(e.currentTarget)}
        >
          Add step
        </Button>
        <Menu
          anchorEl={addAnchor}
          open={Boolean(addAnchor)}
          onClose={() => setAddAnchor(null)}
        >
          {ADDABLE.map((type) => (
            <MenuItem
              key={type}
              onClick={() => {
                handlers.onAdd(parentPath, type);
                setAddAnchor(null);
              }}
            >
              <Box sx={{ mr: 1, display: 'inline-flex' }}>
                {STEP_META[type].icon}
              </Box>
              {STEP_META[type].label}
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </Stack>
  );
};
