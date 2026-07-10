/**
 * The run mechanics of a rater — inputs form, Run button, and the
 * outputs / outcome / step-trace display — extracted so both the rater detail
 * page and the "Rate" drawer (launched from a record) share one implementation.
 *
 * Pre-fill has two modes: a fixed `sourceRow` (auto-seeded on mount, used by the
 * drawer) and, when `allowManualPrefill` is set, the record picker used on the
 * detail page. Runs are tagged with `sourceRecord` for audit. The parent is
 * notified of each run via `onRunStateChange` (the detail page feeds it to the
 * diagram to highlight the executed path).
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RATER_ENTITY_PICKERS,
  type RaterEntityTable,
} from '#/lib/raterPickers';
import { RunRaterError, runRater } from '#/lib/raters';
import type {
  RaterDefinition,
  RaterOutcome,
  RaterOutputValue,
  RecordMapping,
  TraceStep,
} from '#/types/raters';
import { OutcomeBanner } from './OutcomeBanner';
import { OutputCards } from './OutputCards';
import { RaterInputsForm, type RaterInputsFormHandle } from './RaterInputsForm';
import { RecordPicker } from './RecordPicker';
import { TracePanel } from './TracePanel';

export interface RaterRunState {
  outputs: Record<string, RaterOutputValue> | null;
  outcome: RaterOutcome | null;
  trace: TraceStep[] | null;
  error: string | null;
}

const EMPTY_RUN: RaterRunState = {
  outputs: null,
  outcome: null,
  trace: null,
  error: null,
};

export interface RaterRunPanelProps {
  raterId: string;
  definition: RaterDefinition;
  recordMapping?: RecordMapping | null;
  archived?: boolean;
  /** Auto pre-fill inputs from this row and tag runs with its id (drawer use). */
  sourceRow?: Record<string, unknown> | null;
  /** Show the manual "pre-fill from <table>" picker (detail page). */
  allowManualPrefill?: boolean;
  /** Called after each run so a parent can react (e.g. highlight a diagram). */
  onRunStateChange?: (state: RaterRunState) => void;
}

export const RaterRunPanel = ({
  raterId,
  definition,
  recordMapping,
  archived,
  sourceRow,
  allowManualPrefill,
  onRunStateChange,
}: RaterRunPanelProps) => {
  const queryClient = useQueryClient();
  const formRef = useRef<RaterInputsFormHandle>(null);
  const [sourceRecord, setSourceRecord] = useState<{
    table: string;
    id: number;
  } | null>(null);
  const [runState, setRunState] = useState<RaterRunState>(EMPTY_RUN);

  const emit = (state: RaterRunState) => {
    setRunState(state);
    onRunStateChange?.(state);
  };

  // Seed mapped inputs from a record row and remember it as the run's source.
  const prefill = useCallback(
    (row: Record<string, unknown> | null) => {
      if (!recordMapping || !row) {
        setSourceRecord(null);
        return;
      }
      formRef.current?.seed(
        Object.fromEntries(
          (recordMapping.mappings ?? []).map((m) => [m.input, row[m.column]]),
        ),
      );
      setSourceRecord({ table: recordMapping.table, id: row.id as number });
    },
    [recordMapping],
  );

  // Drawer launch: pre-fill once from the fixed source row.
  useEffect(() => {
    if (sourceRow) prefill(sourceRow);
  }, [sourceRow, prefill]);

  const run = useMutation({
    mutationFn: async () => {
      const collected = formRef.current?.collect();
      if (!collected) throw new Error('Inputs are not ready');
      if (!collected.ok) throw new Error(collected.message);
      return runRater({
        raterId,
        inputs: collected.values,
        ...(sourceRecord ? { sourceRecord } : {}),
      });
    },
    onSuccess: (result) => {
      emit({
        outputs: result.outputs,
        outcome: result.outcome,
        trace: result.trace.steps,
        error: null,
      });
      queryClient.invalidateQueries({ queryKey: ['rater_runs', raterId] });
    },
    onError: (e: Error) => {
      const trace =
        e instanceof RunRaterError ? (e.trace?.steps ?? null) : null;
      emit({ outputs: null, outcome: null, trace, error: e.message });
      queryClient.invalidateQueries({ queryKey: ['rater_runs', raterId] });
    },
  });

  const picker =
    allowManualPrefill && recordMapping
      ? RATER_ENTITY_PICKERS[recordMapping.table as RaterEntityTable]
      : undefined;

  return (
    <Stack spacing={2}>
      {recordMapping && picker && (
        <Box sx={{ maxWidth: 360 }}>
          <RecordPicker
            label={`Pre-fill from ${recordMapping.table}`}
            table={picker.queryTable}
            searchColumns={picker.searchColumns}
            getOptionLabel={picker.getOptionLabel}
            onSelect={(row) => prefill(row)}
          />
        </Box>
      )}
      {definition.inputs.length ? (
        <RaterInputsForm ref={formRef} inputs={definition.inputs} />
      ) : (
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          This rater has no inputs.
        </Typography>
      )}
      <Box>
        <Button
          variant='contained'
          startIcon={
            run.isPending ? (
              <CircularProgress size={14} color='inherit' />
            ) : (
              <Play size={15} />
            )
          }
          disabled={run.isPending || Boolean(archived)}
          onClick={() => run.mutate()}
        >
          Run
        </Button>
      </Box>
      {runState.error && <Alert severity='error'>{runState.error}</Alert>}
      {runState.outcome && <OutcomeBanner outcome={runState.outcome} />}
      {runState.outputs && Object.keys(runState.outputs).length > 0 && (
        <OutputCards outputs={runState.outputs} />
      )}
      {runState.trace && (
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.75 }}>
            Step trace
          </Typography>
          <TracePanel steps={runState.trace} />
        </Box>
      )}
    </Stack>
  );
};
