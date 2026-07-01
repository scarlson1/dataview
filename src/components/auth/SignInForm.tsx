import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { supabase } from "#/supabaseClient";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = ({ value }: { value: string }) =>
	!value
		? "Email is required"
		: EMAIL_RE.test(value)
			? undefined
			: "Enter a valid email address";

const validatePassword = ({ value }: { value: string }) =>
	value ? undefined : "Password is required";

const inputSx = {
	"& .MuiOutlinedInput-root": { height: 46, fontSize: 15 },
	"& .MuiOutlinedInput-input": { padding: "0 14px" },
} as const;

const FieldLabel = ({ children }: { children: string }) => (
	<Typography
		component="label"
		sx={{
			display: "block",
			fontSize: 12.5,
			fontWeight: 500,
			color: "text.secondary",
			mb: "6px",
		}}
	>
		{children}
	</Typography>
);

interface SignInFormProps {
	onSuccess: () => void;
}

export const SignInForm = ({ onSuccess }: SignInFormProps) => {
	const form = useForm({
		defaultValues: { email: "", password: "" },
		onSubmit: async ({ value }) => {
			const { error } = await supabase.auth.signInWithPassword({
				email: value.email,
				password: value.password,
			});
			if (error) {
				toast.error(error.message);
				return;
			}
			onSuccess();
		},
	});

	return (
		<Box
			component="form"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				void form.handleSubmit();
			}}
			noValidate
		>
			<form.Field
				name="email"
				validators={{ onChange: validateEmail, onSubmit: validateEmail }}
			>
				{(field) => {
					// Show errors once the field has been interacted with or a submit
					// has been attempted (submit runs the validators and populates
					// `errors` even when the field was never focused).
					const showError = field.state.meta.errors.length > 0;
					return (
						<Box sx={{ mb: "18px" }}>
							<FieldLabel>Email</FieldLabel>
							<TextField
								fullWidth
								type="email"
								placeholder="you@company.com"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								error={showError}
								helperText={
									showError ? String(field.state.meta.errors[0]) : " "
								}
								sx={inputSx}
							/>
						</Box>
					);
				}}
			</form.Field>

			<form.Field
				name="password"
				validators={{ onChange: validatePassword, onSubmit: validatePassword }}
			>
				{(field) => {
					// Show errors once the field has been interacted with or a submit
					// has been attempted (submit runs the validators and populates
					// `errors` even when the field was never focused).
					const showError = field.state.meta.errors.length > 0;
					return (
						<Box sx={{ mb: "6px" }}>
							<FieldLabel>Password</FieldLabel>
							<TextField
								fullWidth
								type="password"
								placeholder="••••••••••"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								error={showError}
								helperText={
									showError ? String(field.state.meta.errors[0]) : " "
								}
								sx={inputSx}
							/>
						</Box>
					);
				}}
			</form.Field>

			<Box sx={{ display: "flex", justifyContent: "flex-end", mb: "22px" }}>
				<Link
					component="button"
					type="button"
					underline="none"
					sx={{ fontSize: 13, fontWeight: 500 }}
				>
					Forgot password?
				</Link>
			</Box>

			<form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
				{([canSubmit, isSubmitting]) => (
					<Button
						type="submit"
						fullWidth
						variant="contained"
						disabled={!canSubmit}
						sx={{
							height: 46,
							fontSize: 14,
							fontWeight: 600,
							letterSpacing: "0.03em",
							textTransform: "uppercase",
						}}
					>
						{isSubmitting ? "Signing in…" : "Sign in"}
					</Button>
				)}
			</form.Subscribe>
		</Box>
	);
};
