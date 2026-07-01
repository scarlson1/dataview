import Box from "@mui/material/Box";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sidebar } from "../components/dashboard/Sidebar";
import {
	TableViewer,
	type ViewerTab,
} from "../components/dashboard/TableViewer";
import { TopBar } from "../components/dashboard/TopBar";
import { TABLES, type TableName } from "../data/tables";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
	const navigate = useNavigate();
	const [collapsed, setCollapsed] = useState(false);
	const [activeTable, setActiveTable] = useState<TableName>("users");
	const [tab, setTab] = useState<ViewerTab>("data");
	const [search, setSearch] = useState("");
	const [nonce, setNonce] = useState(0);

	const table = TABLES[activeTable];

	const selectTable = (name: TableName) => {
		setActiveTable(name);
		setSearch("");
	};

	return (
		<Box
			sx={{
				display: "flex",
				height: "100vh",
				width: "100%",
				overflow: "hidden",
				backgroundColor: "background.default",
			}}
		>
			<Sidebar
				collapsed={collapsed}
				activeTable={activeTable}
				onSelectTable={selectTable}
				onSignOut={() => navigate({ to: "/login" })}
			/>

			<Box
				sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}
			>
				<TopBar
					activeName={table.label}
					onToggleSidebar={() => setCollapsed((c) => !c)}
				/>
				<Box sx={{ flex: 1, overflow: "auto", p: "24px 28px 40px" }}>
					<TableViewer
						key={nonce}
						table={table}
						tab={tab}
						onTabChange={setTab}
						search={search}
						onSearch={setSearch}
						onRefresh={() => setNonce((n) => n + 1)}
					/>
				</Box>
			</Box>
		</Box>
	);
}
