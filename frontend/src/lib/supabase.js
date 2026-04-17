// Supabase client — singleton used everywhere in the app.
// Env vars are set at build time by Vercel (or in .env.local for dev).
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Don't throw — show a friendly runtime error banner on the login page instead.
  console.warn('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Login will not work until these are set. See SETUP.md.')
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // handle the magic-link redirect
  },
})

export const supabaseConfigured = !!(url && anonKey)
