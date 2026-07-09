/**
 * Monospace text field for rater expressions. Live-parses via the shared
 * evaluator: parse errors and unknown-binding references show inline, and the
 * bindings available at this step position render as clickable chips that
 * insert at the cursor.
 */

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import { useMemo, useRef } from 'react';
import { MONO_FONT } from '#/theme/tokens';
import { ExprError, parse, referencedBindings } from '#rater-shared/expr.ts';

interface ExpressionFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Names valid at this position: step bindings plus `inputs.<name>` refs. */
  availableBindings: string[];
  placeholder?: string;
  required?: boolean;
  /** Hide the binding chips (e.g. compact contexts like filter rows). */
  hideChips?: boolean;
}

const validate = (src: string, available: string[]): { error?: string } => {
  if (!src.trim()) return {};
  let node: ReturnType<typeof parse>;
  try {
    node = parse(src);
  } catch (e) {
    return { error: e instanceof ExprError ? e.message : String(e) };
  }
  const allowed = new Set(available);
  for (const ref of referencedBindings(node)) {
    if (ref === 'inputs') continue;
    if (!allowed.has(ref)) {
      return { error: `unknown name '${ref}'` };
    }
  }
  return {};
};

export const ExpressionField = ({
  label,
  value,
  onChange,
  availableBindings,
  placeholder,
  required,
  hideChips,
}: ExpressionFieldProps) => {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const { error } = useMemo(
    () => validate(value, availableBindings),
    [value, availableBindings],
  );

  const insertAtCursor = (text: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  return (
    <Box>
      <TextField
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputRef={inputRef}
        placeholder={placeholder}
        required={required}
        error={Boolean(error)}
        helperText={error}
        size='small'
        fullWidth
        multiline
        maxRows={4}
        slotProps={{
          input: { sx: { fontFamily: MONO_FONT, fontSize: 13 } },
        }}
      />
      {!hideChips && availableBindings.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
          {availableBindings.map((name) => (
            <Chip
              key={name}
              label={name}
              size='small'
              variant='outlined'
              sx={{ fontFamily: MONO_FONT, fontSize: 11, height: 20 }}
              onClick={() => insertAtCursor(name)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};
