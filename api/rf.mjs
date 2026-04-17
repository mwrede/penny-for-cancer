// Vercel Edge Function — proxies Roboflow Workflow calls.
// Now authenticated: requires a Supabase JWT, enforces a per-user daily limit,
// and reads the Roboflow API key from an env var (never hardcoded).

import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

const RF_WORKSPACE = 'michael-h89ju'
const ALLOWED_WORKFLOWS = new Set([
  'penny-area-measurement-pipeline-1776292482637',
  'custom-workflow-11',
])
const DAILY_LIMIT = 20

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, ...extraHeaders, 'Content-Type': 'application/json' },
  })
}

function today() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD in UTC
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ROBOFLOW_API_KEY) {
    return json(500, { error: 'Server not configured. Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or ROBOFLOW_API_KEY env vars.' })
  }

  // Auth: require a valid Supabase JWT
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json(401, { error: 'Missing Authorization header. Please sign in.' })
  }
  const jwt = authHeader.slice('Bearer '.length)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
  if (userErr || !userData?.user) {
    return json(401, { error: 'Invalid or expired session. Please sign in again.' })
  }
  const userId = userData.user.id

  let body
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }
  const { workflowId, imageBase64 } = body || {}
  if (!workflowId || !imageBase64) return json(400, { error: 'workflowId and imageBase64 required' })
  if (!ALLOWED_WORKFLOWS.has(workflowId)) return json(400, { error: 'Unknown workflow' })

  // Rate limit: 20 per UTC day per user
  const day = today()
  const { data: existing } = await supabase
    .from('api_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle()
  const currentCount = existing?.count ?? 0
  if (currentCount >= DAILY_LIMIT) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    return json(429, {
      error: `Daily limit of ${DAILY_LIMIT} analyses reached. Come back tomorrow!`,
      resetAt: tomorrow,
    })
  }

  // Call Roboflow
  const url = `https://serverless.roboflow.com/${RF_WORKSPACE}/workflows/${workflowId}`
  let rfResp
  try {
    rfResp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        api_key: ROBOFLOW_API_KEY,
        inputs: { image: { type: 'base64', value: imageBase64 } },
      }),
    })
  } catch (e) {
    return json(502, { error: `Proxy fetch failed: ${e.message}` })
  }

  // Only charge against the rate limit when Roboflow succeeded
  if (rfResp.ok) {
    await supabase
      .from('api_usage')
      .upsert(
        { user_id: userId, day, count: currentCount + 1 },
        { onConflict: 'user_id,day' }
      )
  }

  const text = await rfResp.text()
  return new Response(text, {
    status: rfResp.status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': rfResp.headers.get('content-type') || 'application/json',
    },
  })
}
