import { createClient } from '@supabase/supabase-js'

export function hentSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const noekkel = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL er ikke satt')
  if (!noekkel) throw new Error('SUPABASE_SERVICE_ROLE_KEY er ikke satt')
  return createClient(url, noekkel, { auth: { persistSession: false } })
}
