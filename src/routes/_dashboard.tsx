import Box from "@mui/material/Box";
import {
	createFileRoute,
	Outlet,
	redirect,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "#/supabaseClient";
import { Sidebar } from "../components/dashboard/Sidebar";
import { TopBar } from "../components/dashboard/TopBar";
import { getTable, type TableName } from "../data/tables";

export const Route = createFileRoute("/_dashboard")({
	beforeLoad: async () => {
		const { data } = await supabase.auth.getSession();
		if (!data.session) {
			throw redirect({ to: "/login" });
		}
	},
	component: DashboardLayout,
});

function DashboardLayout() {
	const navigate = useNavigate();
	const [collapsed, setCollapsed] = useState(false);
	const { table: tableName } = useParams({ strict: false });
	const activeTable = (tableName ?? "") as TableName;
	const table = getTable(activeTable);

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
				onSelectTable={(name) =>
					navigate({ to: "/$table", params: { table: name } })
				}
				onSignOut={async () => {
					await supabase.auth.signOut();
					navigate({ to: "/login" });
				}}
			/>

			<Box
				sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}
			>
				<TopBar
					activeName={table?.label ?? ""}
					onToggleSidebar={() => setCollapsed((c) => !c)}
				/>
				<Box sx={{ flex: 1, overflow: "auto", p: "24px 28px 40px" }}>
					<Outlet />
				</Box>
			</Box>
		</Box>
	);
}
