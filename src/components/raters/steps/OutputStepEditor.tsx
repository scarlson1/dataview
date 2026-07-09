import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import type { OutputStep } from '#/types/raters';
import { ExpressionField } from '../ExpressionField';

interface OutputStepEditorProps {
  step: OutputStep;
  onChange: (step: OutputStep) => void;
  availableBindings: string[];
}

const FORMATS: { value: OutputStep['format']; label: string }[] = [
  { value: 'money', label: 'Money ($)' },
  { value: 'percent', label: 'Percent (%)' },
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Text' },
];

export const OutputStepEditor = ({
  step,
  onChange,
  availableBindings,
}: OutputStepEditorProps) => (
  <Stack spacing={1.5}>
    <Stack direction='row' spacing={1.5}>
      <TextField
        label='Result label'
        value={step.label}
        onChange={(e) => onChange({ ...step, label: e.target.value })}
        size='small'
        required
        sx={{ flex: 1 }}
      />
      <TextField
        label='Format'
        value={step.format}
        onChange={(e) =>
          onChange({ ...step, format: e.target.value as OutputStep['format'] })
        }
        size='small'
        select
        sx={{ width: 140 }}
      >
        {FORMATS.map((f) => (
          <MenuItem key={f.value} value={f.value}>
            {f.label}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
    <ExpressionField
      label='Value'
      value={step.expr}
      onChange={(expr) => onChange({ ...step, expr })}
      availableBindings={availableBindings}
      placeholder='premium'
      required
    />
  </Stack>
);
