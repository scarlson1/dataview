/**
 * Test-run tab of the builder: fill the declared inputs, dry-run the CURRENT
 * (possibly unsaved) definition through run-rater, and show outputs + the
 * step trace. The trace is lifted to the builder so the Diagram tab can
 * highlight the executed path.
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { useRef, useState } from 'react';
import { RunRaterError, runRater } from '#/lib/raters';
import type {
  RaterDefinition,
  RaterOutcome,
  RaterOutputValue,
  TraceStep,
} from '#/types/raters';
import { OutputCards } from './OutputCards';
import { OutcomeBanner } from './OutcomeBanner';
import { RaterInputsForm, type RaterInputsFormHandle } from './RaterInputsForm';
import { TracePanel } from './TracePanel';

export interface TestRunState {
  outputs: Record<string, RaterOutputValue> | null;
  outcome: RaterOutcome | null;
  trace: TraceStep[] | null;
  error: string | null;
}

interface TestRunPanelProps {
  definition: RaterDefinition;
  /** Blocks running while the definition has validation errors. */
  blocked?: string | null;
  onResult?: (state: TestRunState) => void;
}

export const TestRunPanel = ({
  definition,
  blocked,
  onResult,
}: TestRunPanelProps) => {
  const formRef = useRef<RaterInputsFormHandle>(null);
  const [state, setState] = useState<TestRunState>({
    outputs: null,
    outcome: null,
    trace: null,
    error: null,
  });

  const update = (next: TestRunState) => {
    setState(next);
    onResult?.(next);
  };

  const run = useMutation({
    mutationFn: async () => {
      const collected = formRef.current?.collect();
      if (!collected) throw new Error('Inputs are not ready');
      if (!collected.ok) throw new Error(collected.message);
      return runRater({ definition, inputs: collected.values, dryRun: true });
    },
    onSuccess: (result) => {
      update({
        outputs: result.outputs,
        outcome: result.outcome,
        trace: result.trace.steps,
        error: null,
      });
    },
    onError: (e: Error) => {
      const trace =
        e instanceof RunRaterError ? (e.trace?.steps ?? null) : null;
      update({ outputs: null, outcome: null, trace, error: e.message });
    },
  });

  // Remount the form when the input declarations change shape.
  const formKey = definition.inputs.map((i) => `${i.name}:${i.type}`).join('|');

  return (
    <Stack spacing={2}>
      {definition.inputs.length ? (
        <RaterInputsForm
          key={formKey}
          ref={formRef}
          inputs={definition.inputs}
        />
      ) : (
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          This rater has no inputs yet.
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
          disabled={run.isPending || Boolean(blocked)}
          onClick={() => run.mutate()}
        >
          Test run
        </Button>
        {blocked && (
          <Typography
            component='span'
            sx={{ fontSize: 12, color: 'text.secondary', ml: 1.5 }}
          >
            {blocked}
          </Typography>
        )}
      </Box>

      {state.error && <Alert severity='error'>{state.error}</Alert>}
      {state.outputs && Object.keys(state.outputs).length > 0 && (
        <OutputCards outputs={state.outputs} />
      )}
      {state.trace && (
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.75 }}>
            Step trace
          </Typography>
          <TracePanel steps={state.trace} />
        </Box>
      )}
    </Stack>
  );
};
