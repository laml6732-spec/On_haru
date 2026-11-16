import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';

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

r = await worker.fetch(request({...base,event:'exclude'}),env);
assert.equal(r.status,204);
assert.equal(events.at(-1).length,1,'exclusion is recorded separately; raw visits are untouched');
assert.match(events.at(-1)[0].sql,/metric_excluded_devices/);
assert.equal(events.at(-1)[0].args[2],'developer');
assert.equal(events.at(-1)[0].args[1],events[0][0].args[1]);

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

// Exercise the actual browser tracker without opening the live site.
function simulateClient({webdriver=false, search='', developer=false, dnt='0'}={}) {
  const values = new Map();
  if (developer) values.set('onharu.metrics.developer.v1','1');
  const calls = [];
  const navigator = {webdriver,doNotTrack:dnt,globalPrivacyControl:false,standalone:false};
  const storage = {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  runInNewContext(client,{
    location:{hostname:'on-haru.laml6732.workers.dev',search},
    localStorage:storage,
    navigator,window:{navigator,matchMedia:()=>({matches:false}),addEventListener:()=>{}},
    crypto:{randomUUID:()=>uuid}, URLSearchParams,
    fetch:(_url,options)=>{calls.push(JSON.parse(options.body));return Promise.resolve({ok:true});}
  });
  return {calls,values};
}
assert.deepEqual(simulateClient({webdriver:true}).calls,[],'Playwright must not create a visit');
assert.deepEqual(simulateClient({search:'?onharu_metrics=qa'}).calls,[],'Explicit QA mode skips visits');
assert.deepEqual(simulateClient({dnt:'1'}).calls,[],'Do Not Track remains respected');
assert.equal(simulateClient().calls[0].event,'visit');
const developerSession=simulateClient({search:'?onharu_metrics=developer'});
assert.equal(developerSession.calls.length,1);
assert.equal(developerSession.calls[0].event,'exclude');
assert.equal(developerSession.values.get('onharu.metrics.developer.v1'),'1');
assert.equal(simulateClient({developer:true}).calls[0].event,'exclude','Exclusion persists locally');

const migration = await readFile('cloudflare/metrics-segmentation.sql','utf8');
assert.match(migration,/CREATE TABLE IF NOT EXISTS metric_excluded_devices/);
assert.match(migration,/onharu_nonexcluded_overview_utc/);
assert.match(migration,/onharu_device_segments_utc/);
console.log('PASS On_HARU metrics: privacy, QA exclusion, developer opt-out, historical views, installation, dual origins and PWA cache marker');
