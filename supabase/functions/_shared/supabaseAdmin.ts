import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types'; // Your auto-generated types

// 1. Get your Supabase URL and Service Role Key from environment variables
const supabaseUrl = process.env.SUPABASE_URL as string
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY as string

// 2. Initialize the admin client
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  }
)
