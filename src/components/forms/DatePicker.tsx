import {
  DatePicker as MuiDatePicker,
  type DatePickerProps as MuiDatePickerProps,
} from '@mui/x-date-pickers';
import { useSelector } from '@tanstack/react-store';
import type { Dayjs } from 'dayjs';
import { useFieldContext } from '#/hooks/formContext';

type DatePickerProps = Omit<
  MuiDatePickerProps,
  'onBlur' | 'error' | 'select' // | 'onChange'
>;

export default function DatePicker({ label, ...props }: DatePickerProps) {
  const { state, store, handleBlur, handleChange } =
    useFieldContext<Dayjs | null>();
  const errors = useSelector(store, (state) => state.meta.errors);

  return (
    <MuiDatePicker
      label={label}
      // defaultValue={state.value}
      value={state.value}
      onChange={(newVal) => handleChange(newVal)}
      views={['day', 'month', 'year']}
      {...props}
      slotProps={{
        nextIconButton: { size: 'small' },
        previousIconButton: { size: 'small' },
        ...(props.slotProps || {}),
        textField: {
          helperText: errors.join(', '),
          onBlur: handleBlur,
          ...(props.slotProps?.textField || {}),
        },
      }}
    />
  );
}
