# Evertas MGA Dashboard

A web dashboard for the Evertas managing general agent (MGA), porting the SingleSource underwriting workbook to a browser-based application.

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** — dev server and build
- **TanStack** Router, Query, Form, and Store
- **MUI** (Material UI) + MUI X Data Grid / Date Pickers
- **Supabase** — Postgres database, auth, and edge functions
- **Zod** — schema validation
- **Biome** — formatting and linting
- **Vitest** — testing

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for the local database)

### Setup

```bash
# Install dependencies
pnpm install

# Start the local Supabase stack
pnpm supabase start

# Apply migrations and seed data
pnpm reset:db:local

# Start the dev server (http://localhost:3000)
pnpm dev

# Start edge functions
pnpm supabase functions serve
```

Create a `.env.local` file with your local Supabase credentials (URL and anon key from `pnpm supabase status`).

## Scripts

| Command                | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `pnpm dev`             | Start the Vite dev server on port 3000               |
| `pnpm build`           | Build for production                                 |
| `pnpm preview`         | Preview the production build                         |
| `pnpm test`            | Run the test suite (Vitest)                          |
| `pnpm check`           | Run Biome format + lint checks                       |
| `pnpm format`          | Format files with Biome                              |
| `pnpm lint`            | Lint files with Biome                                |
| `pnpm gen:types`       | Regenerate TypeScript types from the Supabase schema |
| `pnpm generate-routes` | Regenerate the TanStack Router route tree            |
| `pnpm reset:db:local`  | Reset the local Supabase database                    |
| `pnpm apply-migration` | Apply pending migrations to the local database       |

## Project Structure

```
src/
  components/   Shared UI components
  constants/    App-wide constants
  data/         Data access + generated database types
  hooks/        React hooks
  lib/          Utilities
  routes/       TanStack Router route definitions
  theme/        MUI theme configuration
supabase/
  migrations/   Database migrations
  functions/    Edge functions
  seed.sql      Seed data
docs/           Architecture, database, and planning docs
```

## Documentation

See the [`docs/`](docs/) directory for details:

- [DATABASE.md](docs/DATABASE.md) — database schema
- [RBAC_PLAN.md](docs/RBAC_PLAN.md) — role-based access control (roles, RLS, invites)
- [ROADMAP.md](docs/ROADMAP.md) — project roadmap
- [SUPABASE_QUICKSTART.md](docs/SUPABASE_QUICKSTART.md) — Supabase setup

## TODO
