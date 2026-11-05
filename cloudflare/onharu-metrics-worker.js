// Privacy-minimal aggregate activity collection for On_HARU.
// Separate Worker + D1 database. No personal notes, IPs, URLs, or text content are stored.
const ALLOWED_ORIGINS = new Map([
  ['https://on-haru.laml6732.workers.dev', 'workers'],
  ['https://on-haru-pages.pages.dev', 'pages'],
]);
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function headersFor(origin) {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Origin' });
  if (ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    headers.set('Access-Control-Max-Age', '600');
  }
  return headers;
}

async function hashDevice(site, deviceId) {
  const input = new TextEncoder().encode(site + ':' + deviceId);
  const bytes = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const headers = headersFor(origin);
    if (url.pathname !== '/event') return new Response('Not Found', { status: 404, headers });
    if (request.method === 'OPTIONS') return new Response(null, { status: ALLOWED_ORIGINS.has(origin) ? 204 : 403, headers });
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers });
    if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403, headers });
    if (Number(request.headers.get('content-length') || 0) > 512) return new Response(null, { status: 413, headers });
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('text/plain')) return new Response(null, { status: 415, headers });

    let message;
    try {
      const raw = await request.text();
      if (raw.length > 512) return new Response(null, { status: 413, headers });
      message = JSON.parse(raw);
    } catch {
      return new Response(null, { status: 400, headers });
    }
    if (!message || message.v !== 1 || !ID_PATTERN.test(message.id || '') ||
        !['visit', 'install'].includes(message.event) ||
        !['browser', 'standalone'].includes(message.mode)) {
      return new Response(null, { status: 400, headers });
    }
    if (!env.METRICS_DB) return new Response(null, { status: 503, headers });
    const site = ALLOWED_ORIGINS.get(origin);
    const id = await hashDevice(site, message.id);
    const installed = message.event === 'install' || message.mode === 'standalone' ? 1 : 0;
    const day = new Date().toISOString().slice(0, 10);
    const tasks = [
      env.METRICS_DB.prepare(`INSERT INTO metric_devices
        (site, device_id, first_seen_at, last_seen_at, installed_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)
        ON CONFLICT(site, device_id) DO UPDATE SET
          last_seen_at = CURRENT_TIMESTAMP,
          installed_at = COALESCE(metric_devices.installed_at, excluded.installed_at)`
      ).bind(site, id, installed)
    ];
    if (message.event === 'visit') {
      tasks.push(env.METRICS_DB.prepare(
        'INSERT OR IGNORE INTO metric_daily_visits(day_utc, site, device_id, standalone) VALUES (?, ?, ?, ?)'
      ).bind(day, site, id, installed));
      if (message.mode === 'standalone') {
        tasks.push(env.METRICS_DB.prepare(
          'INSERT OR IGNORE INTO metric_daily_installed_opens(day_utc, site, device_id) VALUES (?, ?, ?)'
        ).bind(day, site, id));
      }
    }
    try {
      await env.METRICS_DB.batch(tasks);
      return new Response(null, { status: 204, headers });
    } catch (error) {
      console.error('onharu_metrics_write_failed', String(error));
      return new Response(null, { status: 503, headers });
    }
  }
};
