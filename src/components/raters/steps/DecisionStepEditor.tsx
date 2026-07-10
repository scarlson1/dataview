/**
 * Editor for a terminal `decision` step. `outcome` is a free-text label
 * (decline / refer / review / …). `when` gates it — leave empty for an
 * unconditional terminal (e.g. a catch-all "refer"). `reason` is an optional
 * expression shown to the user (quote literal text, e.g. 'Over capacity').
 */

import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { MONO_FONT } from '#/theme/tokens';
import type { DecisionStep } from '#/types/raters';
import { ExpressionField } from '../ExpressionField';

interface DecisionStepEditorProps {
  step: DecisionStep;
  onChange: (step: DecisionStep) => void;
  availableBindings: string[];
}

export const DecisionStepEditor = ({
  step,
  onChange,
  availableBindings,
}: DecisionStepEditorProps) => {
  const conditional = step.when !== undefined;

  return (
    <Stack spacing={1.5}>
      <TextField
        label='Outcome'
        value={step.outcome}
        onChange={(e) => onChange({ ...step, outcome: e.target.value })}
        size='small'
        required
        placeholder='decline'
        helperText='Free text — e.g. decline, refer, review'
        sx={{ width: 240 }}
        slotProps={{ input: { sx: { fontFamily: MONO_FONT, fontSize: 13 } } }}
      />

      <FormControlLabel
        control={
          <Switch
            checked={conditional}
            onChange={(e) =>
              onChange({
                ...step,
                when: e.target.checked ? (step.when ?? '') : undefined,
              })
            }
            size='small'
          />
        }
        label={
          <Typography sx={{ fontSize: 13 }}>
            Only when a condition is met
            <Typography
              component='span'
              sx={{ color: 'text.secondary', ml: 1, fontSize: 12 }}
            >
              {conditional
                ? '(falls through when false)'
                : '(always fires — a terminal end state)'}
            </Typography>
          </Typography>
        }
      />

      {conditional && (
        <ExpressionField
          label='When'
          value={step.when ?? ''}
          onChange={(when) => onChange({ ...step, when })}
          availableBindings={availableBindings}
          placeholder='inputs.score < 600'
          required
        />
      )}

      <ExpressionField
        label='Reason (optional)'
        value={step.reason ?? ''}
        onChange={(reason) =>
          onChange({ ...step, reason: reason.trim() ? reason : undefined })
        }
        availableBindings={availableBindings}
        placeholder="'Score below the 600 minimum'"
      />
    </Stack>
  );
};
