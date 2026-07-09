/**
 * Editor for branch steps. Cases evaluate top-to-bottom; the first truthy
 * condition runs its nested steps, otherwise the `else` list runs. Nested
 * step lists render through StepListEditor (recursion capped by the schema's
 * branch-depth limit).
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Plus, X } from 'lucide-react';
import type { BranchStep, RaterDefinition } from '#/types/raters';
import type { StepPath } from '../definitionUtils';
import { ExpressionField } from '../ExpressionField';
import { StepListEditor, type StepListEditorHandlers } from '../StepListEditor';

interface BranchStepEditorProps {
  step: BranchStep;
  onChange: (step: BranchStep) => void;
  availableBindings: string[];
  /** Everything StepListEditor needs to render + mutate nested lists. */
  definition: RaterDefinition;
  path: StepPath;
  handlers: StepListEditorHandlers;
}

export const BranchStepEditor = ({
  step,
  onChange,
  availableBindings,
  definition,
  path,
  handlers,
}: BranchStepEditorProps) => {
  const setCase = (
    index: number,
    patch: Partial<BranchStep['cases'][number]>,
  ) =>
    onChange({
      ...step,
      cases: step.cases.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    });

  return (
    <Stack spacing={2}>
      {step.cases.map((c, i) => (
        <Box
          // biome-ignore lint/suspicious/noArrayIndexKey: cases are positional
          key={i}
          sx={(t) => ({
            borderLeft: `2px solid ${t.palette.divider}`,
            pl: 1.5,
          })}
        >
          <Stack spacing={1}>
            <Stack direction='row' spacing={1} sx={{ alignItems: 'center' }}>
              <TextField
                label={`Case ${i + 1}`}
                value={c.label}
                onChange={(e) => setCase(i, { label: e.target.value })}
                size='small'
                sx={{ width: 220 }}
              />
              {step.cases.length > 1 && (
                <IconButton
                  size='small'
                  onClick={() =>
                    onChange({
                      ...step,
                      cases: step.cases.filter((_, ci) => ci !== i),
                    })
                  }
                  title='Remove case'
                >
                  <X size={14} />
                </IconButton>
              )}
            </Stack>
            <ExpressionField
              label='When'
              value={c.when}
              onChange={(when) => setCase(i, { when })}
              availableBindings={availableBindings}
              placeholder="upper(inputs.state) == 'NY'"
              required
            />
            <StepListEditor
              definition={definition}
              parentPath={[...path, { case: i }]}
              steps={c.steps}
              handlers={handlers}
              nested
            />
          </Stack>
        </Box>
      ))}

      <Box>
        <Button
          size='small'
          startIcon={<Plus size={14} />}
          onClick={() =>
            onChange({
              ...step,
              cases: [
                ...step.cases,
                { label: `Case ${step.cases.length + 1}`, when: '', steps: [] },
              ],
            })
          }
        >
          Add case
        </Button>
      </Box>

      <Box
        sx={(t) => ({
          borderLeft: `2px dashed ${t.palette.divider}`,
          pl: 1.5,
        })}
      >
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, mb: 1 }}>
          Otherwise (else)
        </Typography>
        <StepListEditor
          definition={definition}
          parentPath={[...path, { case: 'else' }]}
          steps={step.else ?? []}
          handlers={handlers}
          nested
        />
      </Box>
    </Stack>
  );
};
