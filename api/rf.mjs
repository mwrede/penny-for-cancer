// Vercel Edge Function — proxies Roboflow Workflow calls
// Purpose: avoid CORS (serverless.roboflow.com doesn't return CORS headers)
//          and avoid Cloudflare 1010 block that hit Python serverless before
// Edge runtime = V8 isolates on a different IP range than Python functions

export const config = { runtime: 'edge' }

const RF_API_KEY = 'jIlsPhHeCYPv0LCOooQT'
const RF_WORKSPACE = 'michael-h89ju'
const ALLOWED_WORKFLOWS = new Set([
  'penny-area-measurement-pipeline-1776292482637',
  'custom-workflow-11',
])

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const { workflowId, imageBase64 } = body || {}
  if (!workflowId || !imageBase64) {
    return new Response(JSON.stringify({ error: 'workflowId and imageBase64 required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
  if (!ALLOWED_WORKFLOWS.has(workflowId)) {
    return new Response(JSON.stringify({ error: 'Unknown workflow' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const url = `https://serverless.roboflow.com/${RF_WORKSPACE}/workflows/${workflowId}`
  try {
    const rfResp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Browser-like UA helps avoid Cloudflare bot protection (1010)
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        api_key: RF_API_KEY,
        inputs: { image: { type: 'base64', value: imageBase64 } },
      }),
    })
    const text = await rfResp.text()
    return new Response(text, {
      status: rfResp.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': rfResp.headers.get('content-type') || 'application/json',
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: `Proxy fetch failed: ${e.message}` }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
}
