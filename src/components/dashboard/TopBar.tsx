import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
	Bell,
	ChevronRight,
	CircleHelp,
	Moon,
	PanelLeft,
	Sun,
} from "lucide-react";
import { useColorMode } from "../../theme/ColorModeContext";

interface TopBarProps {
	activeName: string;
	onToggleSidebar: () => void;
}

export const TopBar = ({ activeName, onToggleSidebar }: TopBarProps) => {
	const { mode, toggleMode } = useColorMode();

	return (
		<AppBar
			position="static"
			elevation={0}
			sx={(theme) => ({
				height: 64,
				justifyContent: "center",
				backgroundColor: "background.paper",
				color: "text.primary",
				borderBottom: `1px solid ${theme.palette.divider}`,
			})}
		>
			<Toolbar
				disableGutters
				sx={{ minHeight: "64px !important", px: "20px", gap: "6px" }}
			>
				<Tooltip title="Toggle sidebar">
					<IconButton
						onClick={onToggleSidebar}
						sx={{ width: 40, height: 40, ml: "-8px" }}
					>
						<PanelLeft size={22} />
					</IconButton>
				</Tooltip>

				<Box
					sx={{ display: "flex", alignItems: "center", gap: "8px", ml: "6px" }}
				>
					<Typography sx={{ fontSize: 14, color: "text.secondary" }}>
						Tables
					</Typography>
					<Box sx={{ display: "flex", color: "text.disabled" }}>
						<ChevronRight size={18} />
					</Box>
					<Typography
						sx={(theme) => ({
							fontSize: 14,
							fontWeight: 500,
							fontFamily: theme.tokens.mono,
						})}
					>
						{activeName}
					</Typography>
				</Box>

				<Box sx={{ flex: 1 }} />

				<Tooltip title="Toggle theme">
					<IconButton onClick={toggleMode} sx={{ width: 40, height: 40 }}>
						{mode === "dark" ? <Sun size={22} /> : <Moon size={22} />}
					</IconButton>
				</Tooltip>
				<Tooltip title="Notifications">
					<IconButton sx={{ width: 40, height: 40 }}>
						<Bell size={22} />
					</IconButton>
				</Tooltip>
				<Tooltip title="Help">
					<IconButton sx={{ width: 40, height: 40 }}>
						<CircleHelp size={22} />
					</IconButton>
				</Tooltip>
				<Avatar
					sx={(theme) => ({
						width: 36,
						height: 36,
						ml: "6px",
						fontSize: 13,
						fontWeight: 600,
						backgroundColor: theme.tokens.primarySoft,
						color: "primary.main",
					})}
				>
					AL
				</Avatar>
			</Toolbar>
		</AppBar>
	);
};
