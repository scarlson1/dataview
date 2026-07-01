import {
	Clock,
	Database,
	History,
	type LucideIcon,
	Package,
	ReceiptText,
	Users,
	Zap,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
	group: Users,
	receipt_long: ReceiptText,
	inventory_2: Package,
	schedule: Clock,
	bolt: Zap,
	history: History,
};

interface TableIconProps {
	/** Material Symbols name stored on the table definition. */
	name: string;
	size?: number;
	strokeWidth?: number;
}

/** Resolves a table's mock icon name to a lucide icon component. */
export const TableIcon = ({
	name,
	size = 20,
	strokeWidth = 2,
}: TableIconProps) => {
	const Icon = ICONS[name] ?? Database;
	return <Icon size={size} strokeWidth={strokeWidth} />;
};
