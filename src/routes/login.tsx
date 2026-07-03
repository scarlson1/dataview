import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Database, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ToggleDarkMode } from "#/components/ToggleDarkMode";
import { SignInForm } from "../components/auth/SignInForm";
// import { useColorMode } from '../theme/ColorModeContext';

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
	const navigate = useNavigate();
	// const { mode, setMode } = useColorScheme();
	const goToApp = () => navigate({ to: "/" });

	return (
		<Box
			sx={(theme) => ({
				position: "fixed",
				inset: 0,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				p: 3,
				backgroundColor: theme.vars.palette.authBg,
				// backgroundImage: theme.vars.palette.authDots,
				backgroundSize: "22px 22px",
			})}
		>
			<Paper
				elevation={0}
				sx={(theme) => ({
					width: "100%",
					maxWidth: 404,
					border: `1px solid ${theme.vars.palette.borderSoft}`,
					borderRadius: "14px",
					boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 12px 32px rgba(0,0,0,0.14)",
					p: "40px 38px 34px",
				})}
			>
				<Box
					sx={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						textAlign: "center",
						mb: "28px",
					}}
				>
					<Box
						sx={(theme) => ({
							width: 54,
							height: 54,
							borderRadius: "14px",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: "primary.main",
							color: "primary.contrastText",
							mb: "16px",
							boxShadow: `0 4px 12px ${theme.vars.palette.primary.light}`,
						})}
					>
						<Database size={28} />
					</Box>
					<Typography
						sx={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}
					>
						Dataview
					</Typography>
					<Typography sx={{ fontSize: 14, color: "text.secondary", mt: "4px" }}>
						Sign in to your data workspace
					</Typography>
				</Box>

				<SignInForm onSuccess={goToApp} />

				<Divider sx={{ my: "22px", color: "text.disabled", fontSize: 12 }}>
					OR
				</Divider>

				<Button
					fullWidth
					variant="outlined"
					onClick={() => toast.error("SSO is not configured yet")}
					startIcon={<ShieldCheck size={19} />}
					sx={{ height: 46, fontSize: 14, fontWeight: 500 }}
				>
					Continue with SSO
				</Button>

				<Box
					sx={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						mt: "26px",
					}}
				>
					{/* <Box
            onClick={() => setMode()}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontSize: 12.5,
              color: 'text.disabled',
              '&:hover': { color: 'text.secondary' },
            }}
          >
            {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {mode === 'dark' ? 'Light mode' : 'Dark mode'}
          </Box> */}
					<ToggleDarkMode />
				</Box>
			</Paper>
		</Box>
	);
}
