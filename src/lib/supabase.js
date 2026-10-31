import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// false until you paste your keys into .env
export const configured = Boolean(url && key)

export const supabase = createClient(
  url || 'http://localhost:54321',
  key || 'missing-key'
)
