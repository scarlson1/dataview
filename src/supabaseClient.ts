import { createClient } from '@supabase/supabase-js';
import type { Database } from '#/data/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// `.env.local` exposes the new-style publishable key; keep the legacy anon var
// as a fallback so either naming works.
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
