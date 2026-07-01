import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import {
	ChevronLeft,
	ChevronRight,
	Columns3,
	ListFilter,
	Search,
} from "lucide-react";
import {
	capitalize,
	filterRows,
	formatCount,
	type TableColumn,
	type TableDef,
	type TableRow as TableRowData,
} from "../../data/tables";
import { valueTone } from "../../theme/tokens";
import { StatusChip } from "../StatusChip";

const CELL_PAD = "8px 16px";

const isEmpty = (v: unknown): boolean =>
	v === undefined || v === null || v === "";

const DataCell = ({
	column,
	value,
}: {
	column: TableColumn;
	value: unknown;
}) => {
	if (column.kind === "chip" && !isEmpty(value)) {
		const text = capitalize(String(value).replace(/_/g, " "));
		return <StatusChip label={text} tone={valueTone(value)} />;
	}
	const empty = isEmpty(value);
	return (
		<Typography
			component="span"
			sx={(theme) => ({
				fontSize: 13.5,
				fontFamily: column.kind === "mono" ? theme.tokens.mono : "inherit",
				color: empty ? "text.disabled" : "text.primary",
			})}
		>
			{empty ? "—" : String(value)}
		</Typography>
	);
};

interface DataTabProps {
	table: TableDef;
	search: string;
	onSearch: (value: string) => void;
}

export const DataTab = ({ table, search, onSearch }: DataTabProps) => {
	const rows: TableRowData[] = filterRows(table.rows, search);
	const total = search.trim() ? rows.length : table.count;
	const rangeLabel = rows.length
		? `1–${rows.length} of ${formatCount(total)}`
		: `0 of ${formatCount(total)}`;

	return (
		<>
			{/* toolbar */}
			<Box
				sx={(theme) => ({
					display: "flex",
					alignItems: "center",
					gap: "12px",
					p: "12px 16px",
					borderBottom: `1px solid ${theme.tokens.borderSoft}`,
					flexWrap: "wrap",
				})}
			>
				<Box
					sx={(theme) => ({
						display: "flex",
						alignItems: "center",
						gap: "8px",
						height: 38,
						px: "12px",
						border: `1px solid ${theme.palette.divider}`,
						borderRadius: "9px",
						backgroundColor: theme.tokens.paper2,
						flex: "0 1 320px",
						minWidth: 240,
					})}
				>
					<Box sx={{ display: "flex", color: "text.disabled" }}>
						<Search size={19} />
					</Box>
					<InputBase
						value={search}
						onChange={(e) => onSearch(e.target.value)}
						placeholder="Search rows…"
						sx={{ flex: 1, fontSize: 14 }}
					/>
				</Box>
				<Box sx={{ flex: 1 }} />
				<Button
					variant="outlined"
					size="small"
					startIcon={<ListFilter size={18} />}
					sx={{ height: 38 }}
				>
					Filter
				</Button>
				<Button
					variant="outlined"
					size="small"
					startIcon={<Columns3 size={18} />}
					sx={{ height: 38 }}
				>
					Columns
				</Button>
			</Box>

			{/* table */}
			<Box sx={{ overflowX: "auto" }}>
				<Table sx={{ minWidth: 640 }}>
					<TableHead>
						<TableRow>
							{table.columns.map((column) => (
								<TableCell key={column.field}>{column.label}</TableCell>
							))}
						</TableRow>
					</TableHead>
					<TableBody>
						{rows.map((row, i) => (
							<TableRow
								// biome-ignore lint/suspicious/noArrayIndexKey: mock rows have no stable key across tables
								key={i}
								sx={(theme) => ({
									"&:hover": { backgroundColor: theme.tokens.primaryHover },
									"&:last-of-type td": { borderBottom: 0 },
								})}
							>
								{table.columns.map((column) => (
									<TableCell
										key={column.field}
										sx={{
											p: CELL_PAD,
											whiteSpace: "nowrap",
											verticalAlign: "middle",
										}}
									>
										<DataCell column={column} value={row[column.field]} />
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</Box>

			{/* footer */}
			<Box
				sx={(theme) => ({
					display: "flex",
					alignItems: "center",
					justifyContent: "flex-end",
					gap: "22px",
					p: "10px 16px",
					borderTop: `1px solid ${theme.tokens.borderSoft}`,
					fontSize: 13,
					color: "text.secondary",
				})}
			>
				<Typography component="span" sx={{ fontSize: 13 }}>
					Rows per page:{" "}
					<Box component="span" sx={{ fontWeight: 500, color: "text.primary" }}>
						10
					</Box>
				</Typography>
				<Typography
					component="span"
					sx={(theme) => ({ fontSize: 13, fontFamily: theme.tokens.mono })}
				>
					{rangeLabel}
				</Typography>
				<Box sx={{ display: "flex", gap: "2px" }}>
					<IconButton disabled sx={{ width: 34, height: 34 }}>
						<ChevronLeft size={22} />
					</IconButton>
					<IconButton sx={{ width: 34, height: 34 }}>
						<ChevronRight size={22} />
					</IconButton>
				</Box>
			</Box>
		</>
	);
};
