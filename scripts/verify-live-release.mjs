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

/**
 * A strict content attestation, independent of an optional Worker-specific header.
 * The Worker currently forwards Git-integrated Cloudflare Pages responses without
 * x-on-haru-release. SHA-256 matching all five deployed files against this checkout
 * is the release source of truth. If a release header is supplied, it must still agree.
 */
export function verifyAsset({ path, local, actual, release, status, finalURL, baseURL, workerRelease }) {
  const base = new URL(baseURL);
  const intended = new URL(path, base);
  if (path) intended.searchParams.set('rev', release);
  const received = finalURL ? new URL(finalURL) : null;
  const sameURL = !!received && received.origin === intended.origin && received.pathname === intended.pathname;
  const hashMatch = !!actual && hash(local) === hash(actual);
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
    expectedSha256: hash(local), actualSha256: actual ? hash(actual) : null,
    hashMatch, urlMatch: sameURL, bodyReleaseMatch,
    workerRelease: workerRelease || null, releaseHeaderPresent: !!workerRelease,
    releaseEvidence: 'sha256 + same-origin path + HTML/SW embedded release; header optional but checked when present',
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
