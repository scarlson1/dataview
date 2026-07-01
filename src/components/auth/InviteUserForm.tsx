import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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

export const InviteUserForm = () => {
	const form = useForm({
		defaultValues: { email: "" },
		onSubmit: async ({ value, formApi }) => {
			const { error } = await supabase.functions.invoke("invite-user", {
				body: {
					email: value.email,
					redirectTo: `${window.location.origin}/accept-invite`,
				},
			});

			if (error) {
				toast.error(error.message || "Failed to send invite");
				return;
			}

			toast.success(`Invite sent to ${value.email}`);
			formApi.reset();
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
					const showError = field.state.meta.errors.length > 0;
					return (
						<Box sx={{ mb: "14px" }}>
							<FieldLabel>Invite by email</FieldLabel>
							<TextField
								fullWidth
								type="email"
								placeholder="teammate@company.com"
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

			<form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
				{([canSubmit, isSubmitting]) => (
					<Button
						type="submit"
						variant="contained"
						disabled={!canSubmit}
						sx={{ height: 42, fontSize: 14, fontWeight: 600 }}
					>
						{isSubmitting ? "Sending…" : "Send invite"}
					</Button>
				)}
			</form.Subscribe>
		</Box>
	);
};
