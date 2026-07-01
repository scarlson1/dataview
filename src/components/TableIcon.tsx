import { useTheme } from '@mui/material';
import {
  Banknote,
  BadgeCheck,
  Building2,
  Clock,
  CreditCard,
  Database,
  FileCheck2,
  FilePlus2,
  FileText,
  History,
  Landmark,
  type LucideIcon,
  Package,
  ReceiptText,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  // legacy mock names
  group: Users,
  receipt_long: ReceiptText,
  inventory_2: Package,
  schedule: Clock,
  bolt: Zap,
  history: History,
  // domain names (see data/tableMeta.ts)
  agencies: Building2,
  clients: Users,
  underwriters: UserCheck,
  policies: FileText,
  new_business: FilePlus2,
  renewals: RefreshCw,
  binder: ScrollText,
  claims: ShieldAlert,
  invoices: ReceiptText,
  payments: CreditCard,
  receivable: Banknote,
  license: BadgeCheck,
  rules: Landmark,
  carriers: FileCheck2,
};

interface TableIconProps {
  /** Semantic icon key stored on the table definition (see data/tableMeta.ts). */
  name: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

/** Resolves a table's icon key to a lucide icon component. */
export const TableIcon = ({
  name,
  size = 20,
  strokeWidth = 2,
  color,
}: TableIconProps) => {
  const theme = useTheme();
  const Icon = ICONS[name] ?? Database;

  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      color={color ?? theme.vars.palette.text.primary}
    />
  );
};
