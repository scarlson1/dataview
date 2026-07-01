import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Database, LogOut, Network, Settings } from "lucide-react";
import {
	formatCount,
	TABLE_ORDER,
	TABLES,
	type TableName,
} from "../../data/tables";
import { TableIcon } from "../TableIcon";

const SIDEBAR_OPEN = 260;
const SIDEBAR_CLOSED = 74;

interface SidebarProps {
	collapsed: boolean;
	activeTable: TableName;
	onSelectTable: (name: TableName) => void;
	onSignOut: () => void;
}

const FooterItem = ({
	icon,
	label,
	collapsed,
}: {
	icon: React.ReactNode;
	label: string;
	collapsed: boolean;
}) => (
	<Tooltip title={collapsed ? label : ""} placement="right">
		<Box
			sx={(theme) => ({
				display: "flex",
				alignItems: "center",
				gap: "13px",
				height: 40,
				px: "12px",
				borderRadius: "9px",
				cursor: "pointer",
				color: "text.secondary",
				whiteSpace: "nowrap",
				"&:hover": { backgroundColor: theme.tokens.hover },
			})}
		>
			<Box sx={{ display: "flex", flexShrink: 0 }}>{icon}</Box>
			{!collapsed && (
				<Typography sx={{ fontSize: 14, fontWeight: 500 }}>{label}</Typography>
			)}
		</Box>
	</Tooltip>
);

export const Sidebar = ({
	collapsed,
	activeTable,
	onSelectTable,
	onSignOut,
}: SidebarProps) => (
	<Box
		component="aside"
		sx={(theme) => ({
			width: collapsed ? SIDEBAR_CLOSED : SIDEBAR_OPEN,
			flexShrink: 0,
			backgroundColor: "background.paper",
			borderRight: `1px solid ${theme.palette.divider}`,
			display: "flex",
			flexDirection: "column",
			transition: "width 0.2s ease",
			overflow: "hidden",
		})}
	>
		{/* brand */}
		<Box
			sx={(theme) => ({
				height: 64,
				flexShrink: 0,
				display: "flex",
				alignItems: "center",
				gap: "12px",
				px: "17px",
				borderBottom: `1px solid ${theme.tokens.borderSoft}`,
			})}
		>
			<Box
				sx={{
					width: 34,
					height: 34,
					flexShrink: 0,
					borderRadius: "9px",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "primary.main",
					color: "primary.contrastText",
				}}
			>
				<Database size={20} />
			</Box>
			{!collapsed && (
				<Typography
					sx={{
						fontSize: 17,
						fontWeight: 600,
						letterSpacing: "-0.015em",
						whiteSpace: "nowrap",
					}}
				>
					Dataview
				</Typography>
			)}
		</Box>

		{/* table list */}
		<Box
			sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", p: "12px 10px" }}
		>
			{!collapsed && (
				<Typography
					sx={{
						fontSize: 11,
						fontWeight: 700,
						letterSpacing: "0.09em",
						color: "text.disabled",
						p: "6px 12px 8px",
					}}
				>
					TABLES
				</Typography>
			)}
			{TABLE_ORDER.map((name) => {
				const table = TABLES[name];
				const active = name === activeTable;
				return (
					<Tooltip
						key={name}
						title={collapsed ? table.label : ""}
						placement="right"
					>
						<Box
							onClick={() => onSelectTable(name)}
							sx={(theme) => ({
								display: "flex",
								alignItems: "center",
								gap: "13px",
								height: 42,
								px: "12px",
								mb: "2px",
								borderRadius: "9px",
								cursor: "pointer",
								whiteSpace: "nowrap",
								color: active ? "primary.main" : "text.secondary",
								backgroundColor: active
									? theme.tokens.primarySoft
									: "transparent",
								"&:hover": {
									backgroundColor: active
										? theme.tokens.primarySoft
										: theme.tokens.hover,
								},
							})}
						>
							<Box sx={{ display: "flex", flexShrink: 0 }}>
								<TableIcon name={table.icon} size={21} />
							</Box>
							{!collapsed && (
								<>
									<Typography
										sx={{
											flex: 1,
											fontSize: 14,
											fontWeight: 500,
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										{table.label}
									</Typography>
									<Typography
										sx={(theme) => ({
											fontSize: 11,
											fontWeight: 500,
											color: "text.disabled",
											fontFamily: theme.tokens.mono,
										})}
									>
										{formatCount(table.count)}
									</Typography>
								</>
							)}
						</Box>
					</Tooltip>
				);
			})}
		</Box>

		{/* footer */}
		<Box
			sx={(theme) => ({
				flexShrink: 0,
				p: "8px 10px 10px",
				borderTop: `1px solid ${theme.tokens.borderSoft}`,
			})}
		>
			<FooterItem
				icon={<Network size={20} />}
				label="Connections"
				collapsed={collapsed}
			/>
			<FooterItem
				icon={<Settings size={20} />}
				label="Settings"
				collapsed={collapsed}
			/>
			<Divider sx={{ m: "8px 4px" }} />
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					gap: "11px",
					p: "6px 8px",
					whiteSpace: "nowrap",
				}}
			>
				<Avatar
					sx={(theme) => ({
						width: 32,
						height: 32,
						flexShrink: 0,
						fontSize: 13,
						fontWeight: 600,
						backgroundColor: theme.tokens.primarySoft,
						color: "primary.main",
					})}
				>
					AL
				</Avatar>
				{!collapsed && (
					<>
						<Box sx={{ flex: 1, minWidth: 0 }}>
							<Typography
								sx={{
									fontSize: 13,
									fontWeight: 500,
									overflow: "hidden",
									textOverflow: "ellipsis",
								}}
							>
								Ada Lovelace
							</Typography>
							<Typography
								sx={{
									fontSize: 11.5,
									color: "text.secondary",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}}
							>
								ada@acme.io
							</Typography>
						</Box>
						<Tooltip title="Sign out" placement="top">
							<IconButton onClick={onSignOut} size="small">
								<LogOut size={19} />
							</IconButton>
						</Tooltip>
					</>
				)}
			</Box>
		</Box>
	</Box>
);
