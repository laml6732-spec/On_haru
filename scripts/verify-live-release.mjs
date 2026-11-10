import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const DEFAULT_URL = 'https://on-haru.laml6732.workers.dev/';
const ASSETS = [
  ['', 'index.html'],
  ['app.7cb1b71d4eb6.css', 'app.7cb1b71d4eb6.css'],
  ['runtime/legacy-controllers.9a6fbb5e22cc.js', 'runtime/legacy-controllers.9a6fbb5e22cc.js'],
  ['runtime/settings.58b48f87b05a.js', 'runtime/settings.58b48f87b05a.js'],
  ['sw.js', 'sw.js'],
];
const hash = data => createHash('sha256').update(data).digest('hex');

/** Exact, versioned startup-image rewrites already applied by the production bridge.
 * All other bytes must still match the checked-out source. Never strip arbitrary
 * HTML, accept release-marker-only evidence, or normalize unknown differences.
 */
function patchStartupHtml(html){const needle="art.src='./assets/onharu-launch-v3.png';";if(!html.includes(needle))return html;return html.replace(needle,"const launchHour=new Date().getHours(),launchPart=launchHour>=5&&launchHour<11?'morning':launchHour>=11&&launchHour<16?'day':launchHour>=16&&launchHour<21?'sunset':'night';art.src='./onharu-startup-20261109/launch-'+launchPart+'.webp';").replace('</head>',"<style id=\"onharu-startup-images-20261109\">#launchScreen#launchScreen{background:#fffffa!important}#launchScreen#launchScreen #launchArt{display:block!important;width:min(88vw,420px)!important;height:auto!important;max-height:82svh!important;aspect-ratio:auto!important;object-fit:contain!important;filter:none!important;mix-blend-mode:normal!important}</style>"+'</head>');}
function patchStartupCache(script){return script.replace('const CORE=[','const CORE=['+"\"./onharu-startup-20261109/launch-morning.webp\",\"./onharu-startup-20261109/launch-day.webp\",\"./onharu-startup-20261109/launch-sunset.webp\",\"./onharu-startup-20261109/launch-night.webp\",");}

export function workerStartupVariant(path,local) {
  const text=local.toString('utf8');
  if(path===''&&text.includes("art.src='./assets/onharu-launch-v3.png';"))return Buffer.from(patchStartupHtml(text));
  if(path==='sw.js'&&text.includes('const CORE=['))return Buffer.from(patchStartupCache(text));
  return null;
}
export function verifyAsset({ path, local, actual, release, status, finalURL, baseURL, workerRelease }) {
  const base = new URL(baseURL);
  const intended = new URL(path, base);
  if (path) intended.searchParams.set('rev', release);
  const received = finalURL ? new URL(finalURL) : null;
  const sameURL = !!received && received.origin === intended.origin && received.pathname === intended.pathname;
  const sourceHashMatch = !!actual && hash(local) === hash(actual);
  const variant = base.origin === new URL(DEFAULT_URL).origin ? workerStartupVariant(path,local) : null;
  const startupVariantHashMatch = !!actual && !!variant && hash(variant) === hash(actual);
  const hashMatch = sourceHashMatch || startupVariantHashMatch;
  const headerMatch = !workerRelease || workerRelease === release;
  const body = actual ? actual.toString('utf8') : '';
  const bodyReleaseMatch = path === ''
    ? body.includes('name="kona-release" content="' + release + '"')
    : path === 'sw.js'
      ? body.includes("const RELEASE='" + release + "'") || body.includes('const RELEASE="' + release + '"')
      : true;
  return {
    path: path || '/',
    ok: status === 200 && sameURL && hashMatch && headerMatch && bodyReleaseMatch,
    status, finalURL: finalURL || null,
    expectedSha256: hash(startupVariantHashMatch ? variant : local), sourceSha256: hash(local), actualSha256: actual ? hash(actual) : null,
    hashMatch, sourceHashMatch, contentVariant: startupVariantHashMatch ? 'worker-startup-20261109' : 'source', urlMatch: sameURL, bodyReleaseMatch,
    workerRelease: workerRelease || null, releaseHeaderPresent: !!workerRelease,
    releaseEvidence: 'sha256 of exact source or versioned production startup rewrite + same-origin path + HTML/SW embedded release; header optional but checked when present',
  };
}
export async function verifyLiveRelease({ base = DEFAULT_URL, attempts = 4, delayMs = 5000 } = {}) {
  const releaseFile = await fs.readFile('public/legacy/index.html', 'utf8');
  const release = releaseFile.match(/name="kona-release" content="([a-z0-9]+)"/)?.[1];
  if (!release) throw new Error('Local release marker missing from index.html');
  const report = { url: base, release, verifier: 'hash-content-v2', cases: [] };
  for (const [path, source] of ASSETS) {
    const local = await fs.readFile('public/legacy/' + source);
    const url = new URL(path, base);
    if (path) url.searchParams.set('rev', release);
    let result = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
        const body = Buffer.from(await response.arrayBuffer());
        result = verifyAsset({
          path, local, actual: body, release, status: response.status,
          finalURL: response.url, baseURL: base, workerRelease: response.headers.get('x-on-haru-release'),
        });
        if (result.ok) break;
      } catch (error) {
        result = { path: path || '/', ok: false, error: String(error) };
      }
      if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    report.cases.push(result);
    console.log(result.ok ? 'PASS' : 'FAIL', result.path, result.ok ? 'SHA-256 verified' : JSON.stringify(result));
  }
  await fs.mkdir('test-results/live', { recursive: true });
  await fs.writeFile('test-results/live/static.json', JSON.stringify(report, null, 2));
  return report;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const report = await verifyLiveRelease({ base: process.env.ONHARU_URL || DEFAULT_URL });
  if (report.cases.some(row => !row.ok)) process.exitCode = 1;
}
