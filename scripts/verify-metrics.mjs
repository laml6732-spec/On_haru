import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const code = await readFile('cloudflare/onharu-metrics-worker.js','utf8');
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const events = [];
const db = {
  prepare(sql) {
    return { bind(...args) { return { sql, args }; } };
  },
  async batch(statements) {
    events.push(statements);
    return statements.map(() => ({success:true}));
  }
};
const env = { METRICS_DB: db };
const uuid = '34b2f58a-924c-4913-a8dc-c7c01df703ef';
const origin = 'https://on-haru.laml6732.workers.dev';
const base = { v:1, id:uuid, event:'visit', mode:'browser' };
function request(body, site=origin) {
  return new Request('https://onharu-metrics.laml6732.workers.dev/event', {
    method:'POST', headers:{'Content-Type':'text/plain;charset=UTF-8',Origin:site},
    body:JSON.stringify(body)
  });
}

let r = await worker.fetch(request(base,'https://example.com'),env);
assert.equal(r.status,403);
assert.equal(events.length,0);
r = await worker.fetch(request({...base,id:'bad-id'}),env);
assert.equal(r.status,400);
assert.equal(events.length,0);
r = await worker.fetch(request(base),env);
assert.equal(r.status,204);
assert.equal(r.headers.get('access-control-allow-origin'),origin);
assert.equal(events.length,1);
assert.equal(events[0].length,2);
assert.match(events[0][0].sql,/COALESCE\(metric_devices\.installed_at, excluded\.installed_at\)/);
assert.equal(events[0][0].args[0],'workers');
assert.match(events[0][0].args[1],/^[0-9a-f]{64}$/);
assert.notEqual(events[0][0].args[1],uuid);

r = await worker.fetch(request({...base,event:'install'}),env);
assert.equal(r.status,204);
assert.equal(events.at(-1).length,1);
assert.equal(events.at(-1)[0].args.at(-1),1);

r = await worker.fetch(request({...base,mode:'standalone'}),env);
assert.equal(r.status,204);
assert.equal(events.at(-1).length,3);
assert.match(events.at(-1)[2].sql,/metric_daily_installed_opens/);

r = await worker.fetch(request(base,'https://on-haru-pages.pages.dev'),env);
assert.equal(r.status,204);
assert.equal(events.at(-1)[0].args[0],'pages');
assert.notEqual(events.at(-1)[0].args[1],events[0][0].args[1]);

const html = await readFile('public/legacy/index.html','utf8');
const sw = await readFile('public/legacy/sw.js','utf8');
const client = await readFile('public/legacy/runtime/install-metrics.v1.js','utf8');
const marker = html.match(/name="kona-release" content="([a-z0-9]+)"/)?.[1];
assert.ok(marker,'HTML release marker');
assert.match(sw,new RegExp("const RELEASE='"+marker+"'"));
assert.match(html,/install-metrics\.v1\.js" defer/);
assert.ok(sw.includes('runtime/install-metrics.v1.js'));
assert.ok(!client.includes('kona.legacy.v1'), 'Metrics script must not read personal records');
console.log('PASS On_HARU metrics: validation, privacy, installation, standalone, dual origins and PWA cache marker');
