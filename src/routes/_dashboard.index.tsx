/**
 * Home — the landing page shown right after sign-in. Greets the user, surfaces
 * a few book-wide KPIs (bound premium YTD, active policies, open receivables,
 * renewal pipeline) and provides quick jumps into the reports and data tables.
 */
import { money } from '#/lib/money';
import { supabase } from '#/supabaseClient';
import { TableIcon } from '#/components/TableIcon';
import {
  formatTableLabel,
  TABLE_GROUPS,
  TABLES,
  type TableName,
} from '#/data/tables';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  Coins,
  FileDown,
  PiggyBank,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Workflow,
} from 'lucide-react';

export const Route = createFileRoute('/_dashboard/')({
  component: Home,
});

const num = (v: number | null | undefined): number => Number(v) || 0;

interface Summary {
  boundYtd: number;
  activePolicies: number;
  openAr: number;
  openArCount: number;
  pipeline: number;
  openRenewals: number;
}

function Home() {
  const navigate = useNavigate();

  const user = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
  });

  const summary = useQuery<Summary>({
    queryKey: ['home-summary'],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const [policies, aging, renewals] = await Promise.all([
        supabase
          .from('policies_computed')
          .select('status, total_term_premium, policy_eff_date'),
        supabase.from('accounts_receivable_aging').select('balance_due'),
        supabase
          .from('renewals_computed')
          .select('renewal_status, ev_rnw_gwp'),
      ]);
      if (policies.error) throw policies.error;
      if (aging.error) throw aging.error;
      if (renewals.error) throw renewals.error;

      const boundYtd = (policies.data ?? [])
        .filter((p) => Number(p.policy_eff_date?.slice(0, 4)) === year)
        .reduce((a, p) => a + num(p.total_term_premium), 0);
      const activePolicies = (policies.data ?? []).filter(
        (p) => p.status === 'active',
      ).length;

      const openArRows = (aging.data ?? []).filter(
        (r) => num(r.balance_due) > 0,
      );
      const openAr = openArRows.reduce((a, r) => a + num(r.balance_due), 0);

      const pipeline = (renewals.data ?? []).reduce(
        (a, r) => a + num(r.ev_rnw_gwp),
        0,
      );

      return {
        boundYtd,
        activePolicies,
        openAr,
        openArCount: openArRows.length,
        pipeline,
        openRenewals: (renewals.data ?? []).length,
      };
    },
  });

  const s = summary.data;
  const loading = summary.isLoading;
  const greeting = greetingForHour(new Date().getHours());
  const name = user.data?.email ? user.data.email.split('@')[0] : 'there';
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Box
      sx={{
        maxWidth: 1160,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {/* greeting */}
      <Box>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.5 }}>
          {today}
        </Typography>
        <Typography
          sx={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}
        >
          {greeting}, {name}
        </Typography>
        <Typography sx={{ fontSize: 15, color: 'text.secondary', mt: 0.5 }}>
          Here's what's happening across your book of business.
        </Typography>
      </Box>

      {/* KPI row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        <Stat
          icon={<TrendingUp size={18} />}
          label='Bound premium (YTD)'
          value={loading ? '—' : money(s?.boundYtd)}
        />
        <Stat
          icon={<ShieldCheck size={18} />}
          label='Active policies'
          value={loading ? '—' : String(s?.activePolicies ?? 0)}
        />
        <Stat
          icon={<Receipt size={18} />}
          label='Open receivables'
          value={loading ? '—' : money(s?.openAr)}
          hint={
            s?.openArCount
              ? `${s.openArCount} open item${s.openArCount === 1 ? '' : 's'}`
              : undefined
          }
        />
        <Stat
          icon={<Coins size={18} />}
          label='Renewal pipeline (wtd)'
          value={loading ? '—' : money(s?.pipeline)}
          hint={
            s?.openRenewals
              ? `${s.openRenewals} in pipeline`
              : undefined
          }
        />
      </Box>

      {/* Reports & tools */}
      <Box>
        <SectionHeading>Reports & tools</SectionHeading>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: 'repeat(3, 1fr)',
            },
            gap: 2,
          }}
        >
          {SHORTCUTS.map((sc) => (
            <ActionCard
              key={sc.to}
              icon={sc.icon}
              title={sc.title}
              description={sc.description}
              onClick={() => navigate({ to: sc.to })}
            />
          ))}
        </Box>
      </Box>

      {/* Browse data */}
      <Box>
        <SectionHeading>Browse your data</SectionHeading>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: 'repeat(3, 1fr)',
            },
            gap: 2,
          }}
        >
          {TABLE_GROUPS.map((group) => (
            <Paper
              key={group.id}
              variant='outlined'
              sx={{ p: 2, borderRadius: 2 }}
            >
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  color: 'text.disabled',
                  mb: 1,
                }}
              >
                {group.label}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {group.tables.map((tableName) => (
                  <TableLink
                    key={tableName}
                    name={tableName}
                    onClick={() =>
                      navigate({
                        to: '/$table',
                        params: { table: tableName },
                      })
                    }
                  />
                ))}
              </Box>
            </Paper>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

const greetingForHour = (h: number): string =>
  h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';

interface Shortcut {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const SHORTCUTS: Shortcut[] = [
  {
    to: '/workflow',
    title: 'Workflows',
    description: 'Track submissions and renewals through the pipeline.',
    icon: <Workflow size={20} />,
  },
  {
    to: '/budget',
    title: 'Budget proforma',
    description: 'Target GWP vs bound premium vs renewal pipeline.',
    icon: <TrendingUp size={20} />,
  },
  {
    to: '/agd',
    title: 'Aged receivables',
    description: 'Open AR balances bucketed by days past due.',
    icon: <Receipt size={20} />,
  },
  {
    to: '/carrier-prem-com',
    title: 'Carrier prem / com',
    description: 'Premium and commission owed to carriers.',
    icon: <Coins size={20} />,
  },
  {
    to: '/uep',
    title: 'UEP reserve',
    description: 'Unearned premium reserve across the book.',
    icon: <PiggyBank size={20} />,
  },
  {
    to: '/exports',
    title: 'Exports',
    description: 'Download report data as CSV files.',
    icon: <FileDown size={20} />,
  },
];

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1.75 }}>
    {children}
  </Typography>
);

const Stat = ({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) => (
  <Paper variant='outlined' sx={{ p: 2, borderRadius: 2 }}>
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        color: 'text.secondary',
        mb: 1,
      }}
    >
      <Box sx={{ display: 'flex' }}>{icon}</Box>
      <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{label}</Typography>
    </Box>
    <Typography sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
      {value}
    </Typography>
    {hint && (
      <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 0.5 }}>
        {hint}
      </Typography>
    )}
  </Paper>
);

const ActionCard = ({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) => (
  <Paper
    variant='outlined'
    onClick={onClick}
    sx={(theme) => ({
      p: 2,
      borderRadius: 2,
      cursor: 'pointer',
      transition: 'border-color 0.15s ease, background-color 0.15s ease',
      '&:hover': {
        borderColor: 'primary.main',
        backgroundColor: theme.vars.palette.primaryHover,
      },
      '&:hover .home-action-arrow': { opacity: 1, transform: 'translateX(0)' },
    })}
  >
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Box
        sx={(theme) => ({
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.vars.palette.primary.light,
          color: 'primary.main',
        })}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{title}</Typography>
          <Box
            className='home-action-arrow'
            sx={{
              display: 'flex',
              color: 'primary.main',
              opacity: 0,
              transform: 'translateX(-4px)',
              transition: 'opacity 0.15s ease, transform 0.15s ease',
            }}
          >
            <ArrowRight size={18} />
          </Box>
        </Box>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.25 }}>
          {description}
        </Typography>
      </Box>
    </Box>
  </Paper>
);

const TableLink = ({
  name,
  onClick,
}: {
  name: TableName;
  onClick: () => void;
}) => {
  const theme = useTheme();
  const table = TABLES[name];
  if (!table) return null;
  return (
    <Box
      onClick={onClick}
      sx={(t) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.75,
        mx: -1,
        borderRadius: 1,
        cursor: 'pointer',
        color: 'text.secondary',
        '&:hover': {
          backgroundColor: t.vars.palette.hover,
          color: 'text.primary',
        },
      })}
    >
      <TableIcon
        name={table.icon}
        size={17}
        color={theme.vars.palette.text.secondary}
      />
      <Typography sx={{ fontSize: 13.5, fontWeight: 500 }}>
        {formatTableLabel(table.label)}
      </Typography>
    </Box>
  );
};
