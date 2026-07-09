import Stack from '@mui/material/Stack';
import type { CalcStep } from '#/types/raters';
import { ExpressionField } from '../ExpressionField';

interface CalcStepEditorProps {
  step: CalcStep;
  onChange: (step: CalcStep) => void;
  availableBindings: string[];
}

export const CalcStepEditor = ({
  step,
  onChange,
  availableBindings,
}: CalcStepEditorProps) => (
  <Stack spacing={1}>
    <ExpressionField
      label='Formula'
      value={step.expr}
      onChange={(expr) => onChange({ ...step, expr })}
      availableBindings={availableBindings}
      placeholder='inputs.asset_value * base_rate.rate'
      required
    />
  </Stack>
);
