import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { Download, RefreshCw, Rows3, Workflow } from "lucide-react";
import type { TableDef } from "../../data/tables";
import { TableIcon } from "../TableIcon";
import { DataTab } from "./DataTab";
import { SchemaTab } from "./SchemaTab";

export type ViewerTab = "data" | "schema";

interface TableViewerProps {
	table: TableDef;
	tab: ViewerTab;
	onTabChange: (tab: ViewerTab) => void;
	search: string;
	onSearch: (value: string) => void;
	onRefresh: () => void;
}

export const TableViewer = ({
	table,
	tab,
	onTabChange,
	search,
	onSearch,
	onRefresh,
}: TableViewerProps) => (
	<>
		{/* page header */}
		<Box
			sx={{
				display: "flex",
				alignItems: "flex-start",
				justifyContent: "space-between",
				gap: "20px",
				mb: "20px",
				flexWrap: "wrap",
			}}
		>
			<Box sx={{ minWidth: 0 }}>
				<Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
					<Box
						sx={(theme) => ({
							width: 40,
							height: 40,
							borderRadius: "10px",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							flexShrink: 0,
							backgroundColor: theme.tokens.primarySoft,
							color: "primary.main",
						})}
					>
						<TableIcon name={table.icon} size={23} />
					</Box>
					<Typography
						component="h1"
						sx={(theme) => ({
							fontSize: 23,
							fontWeight: 600,
							m: 0,
							letterSpacing: "-0.01em",
							fontFamily: theme.tokens.mono,
						})}
					>
						{table.label}
					</Typography>
					<Box
						component="span"
						sx={(theme) => ({
							fontSize: 11,
							fontWeight: 600,
							letterSpacing: "0.06em",
							color: "text.secondary",
							backgroundColor: theme.tokens.hover,
							p: "3px 8px",
							borderRadius: "5px",
						})}
					>
						TABLE
					</Box>
				</Box>
				<Typography
					sx={{
						fontSize: 14,
						color: "text.secondary",
						mt: "8px",
						maxWidth: 640,
					}}
				>
					{table.description}
				</Typography>
			</Box>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					gap: "10px",
					flexShrink: 0,
				}}
			>
				<Button
					variant="outlined"
					onClick={onRefresh}
					startIcon={<RefreshCw size={19} />}
					sx={{ height: 40 }}
				>
					Refresh
				</Button>
				<Button
					variant="contained"
					startIcon={<Download size={19} />}
					sx={{ height: 40 }}
				>
					Export
				</Button>
			</Box>
		</Box>

		{/* card */}
		<Paper
			elevation={0}
			sx={(theme) => ({
				border: `1px solid ${theme.tokens.borderSoft}`,
				borderRadius: "12px",
				overflow: "hidden",
				boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
			})}
		>
			<Tabs
				value={tab}
				onChange={(_, value: ViewerTab) => onTabChange(value)}
				sx={(theme) => ({
					borderBottom: `1px solid ${theme.palette.divider}`,
					px: "8px",
				})}
			>
				<Tab
					value="data"
					iconPosition="start"
					icon={<Rows3 size={20} />}
					label="Data"
					sx={{ gap: "8px" }}
				/>
				<Tab
					value="schema"
					iconPosition="start"
					icon={<Workflow size={20} />}
					label="Schema"
					sx={{ gap: "8px" }}
				/>
			</Tabs>

			{tab === "data" ? (
				<DataTab table={table} search={search} onSearch={onSearch} />
			) : (
				<SchemaTab table={table} />
			)}
		</Paper>
	</>
);
