import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cache: SupabaseClient | null = null

export function hentSupabaseAdmin(): SupabaseClient {
  if (cache) return cache
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const noekkel = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL er ikke satt')
  if (!noekkel) throw new Error('SUPABASE_SERVICE_ROLE_KEY er ikke satt')
  cache = createClient(url, noekkel, { auth: { persistSession: false } })
  return cache
}
