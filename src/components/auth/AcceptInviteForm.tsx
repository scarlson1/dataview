import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "#/supabaseClient";

const MIN_PASSWORD_LENGTH = 8;

const validatePassword = ({ value }: { value: string }) =>
	value.length >= MIN_PASSWORD_LENGTH
		? undefined
		: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;

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

interface AcceptInviteFormProps {
	onSuccess: () => void;
}

export const AcceptInviteForm = ({ onSuccess }: AcceptInviteFormProps) => {
	// The invite link redirects here with a `code`/hash that supabase-js exchanges
	// for a session automatically (`detectSessionInUrl`, on by default in the
	// browser client). Until that resolves we don't know if the link was valid.
	const [sessionState, setSessionState] = useState<
		"checking" | "valid" | "invalid"
	>("checking");

	useEffect(() => {
		let cancelled = false;

		const check = async () => {
			const { data } = await supabase.auth.getSession();
			if (!cancelled) {
				setSessionState(data.session ? "valid" : "invalid");
			}
		};

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event) => {
			if (event === "SIGNED_IN") setSessionState("valid");
		});

		check();

		return () => {
			cancelled = true;
			subscription.unsubscribe();
		};
	}, []);

	const form = useForm({
		defaultValues: { password: "", confirmPassword: "" },
		onSubmit: async ({ value }) => {
			if (value.password !== value.confirmPassword) {
				toast.error("Passwords do not match");
				return;
			}

			const { error } = await supabase.auth.updateUser({
				password: value.password,
			});
			if (error) {
				toast.error(error.message);
				return;
			}

			toast.success("Password set — you're all set");
			onSuccess();
		},
	});

	if (sessionState === "checking") {
		return (
			<Typography sx={{ fontSize: 14, color: "text.secondary" }}>
				Verifying your invite link…
			</Typography>
		);
	}

	if (sessionState === "invalid") {
		return (
			<Typography sx={{ fontSize: 14, color: "text.secondary" }}>
				This invite link is invalid or has expired. Ask an admin to send you
				a new one.
			</Typography>
		);
	}

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
				name="password"
				validators={{ onChange: validatePassword, onSubmit: validatePassword }}
			>
				{(field) => {
					const showError = field.state.meta.errors.length > 0;
					return (
						<Box sx={{ mb: "18px" }}>
							<FieldLabel>New password</FieldLabel>
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

			<form.Field name="confirmPassword">
				{(field) => (
					<Box sx={{ mb: "6px" }}>
						<FieldLabel>Confirm password</FieldLabel>
						<TextField
							fullWidth
							type="password"
							placeholder="••••••••••"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
							sx={inputSx}
						/>
					</Box>
				)}
			</form.Field>

			<form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
				{([canSubmit, isSubmitting]) => (
					<Button
						type="submit"
						fullWidth
						variant="contained"
						disabled={!canSubmit}
						sx={{
							mt: "16px",
							height: 46,
							fontSize: 14,
							fontWeight: 600,
							letterSpacing: "0.03em",
							textTransform: "uppercase",
						}}
					>
						{isSubmitting ? "Saving…" : "Set password"}
					</Button>
				)}
			</form.Subscribe>
		</Box>
	);
};
