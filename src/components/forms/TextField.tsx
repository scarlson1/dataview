import { useFieldContext } from "@/hooks/formContext";
import type { TextFieldProps as MuiTextFieldProps } from "@mui/material";
import { TextField as MuiTextField } from "@mui/material";
import { useSelector } from '@tanstack/react-store';

type TextFieldProps = Omit<MuiTextFieldProps, "onChange" | "onBlur" | "error">;

export function TextField(props: TextFieldProps) {
	const { state, store, handleBlur, handleChange } = useFieldContext<string>();
  const errors = useSelector(store, (state) => state.meta.errors)

	return (
		<MuiTextField
			fullWidth
			variant="outlined"
			color="primary"
			{...props}
			defaultValue={state.value}
			onChange={(e) => handleChange(e.target.value)}
			onBlur={handleBlur}
			error={state.meta.isTouched && !state.meta.isValid}
			helperText={
				errors.length && state.meta.isTouched
					? errors.map((e) => e?.message).join(", ")
					: props.helperText
			}
		/>
	);
}

export default TextField;
