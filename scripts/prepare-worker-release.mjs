#!/usr/bin/env node
// Prepare an exact, single-line release-header fix from the CURRENT deployed Worker.
// Does not call Cloudflare or deploy anything. Never use the historical Git Worker as input.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const sha256 = text => createHash('sha256').update(text).digest('hex');
const oneMatch = (source, pattern, name) => {
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(name + ' must occur exactly once (found ' + matches.length + ')');
  return matches[0];
};

export function prepareWorkerRelease({ worker, html, serviceWorker, expectedOldRelease, expectedPagesUrl }) {
  if (typeof worker !== 'string' || !worker.includes('addEventListener("fetch"')) {
    throw new Error('Expected the currently deployed On_HARU service-worker-syntax bridge, not a historical or module Worker');
  }
  if (!expectedOldRelease || !expectedPagesUrl) throw new Error('Both expectedOldRelease and expectedPagesUrl are required');
  const htmlRelease = oneMatch(html, /name="kona-release" content="([a-z0-9]+)"/g, 'HTML release marker')[1];
  const swRelease = oneMatch(serviceWorker, /const RELEASE=['"]([a-z0-9]+)['"]/g, 'service worker release marker')[1];
  if (htmlRelease !== swRelease) throw new Error('HTML and PWA service-worker releases differ; abort patch');
  const sourceMatch = oneMatch(worker, /^const SOURCE\s*=\s*"([^"]+)";/gm, 'Worker SOURCE');
  const actualPages = new URL(sourceMatch[1]);
  if (actualPages.protocol !== 'https:' || !/^[a-z0-9-]+\.on-haru-pages\.pages\.dev$/.test(actualPages.hostname)) {
    throw new Error('Worker SOURCE must be an immutable On_HARU Pages deployment');
  }
  if (sourceMatch[1] !== expectedPagesUrl) throw new Error('Pinned Pages URL changed since backup; abort patch');
  if (!worker.includes('headers.set("x-on-haru-deployment", "pages-release-pinned");')) {
    throw new Error('Unexpected Worker bridge; do not apply a patch to unknown source');
  }
  const header = oneMatch(worker, /headers\.set\("x-on-haru-release", "([a-z0-9]+)"\);/g, 'Worker release header');
  const oldRelease = header[1];
  if (oldRelease !== expectedOldRelease) throw new Error('Worker release changed since backup; abort patch');
  if (oldRelease === htmlRelease) throw new Error('Worker header already matches current HTML; nothing to patch');
  const replacement = header[0].replace(oldRelease, htmlRelease);
  const correctedWorker = worker.slice(0, header.index) + replacement + worker.slice(header.index + header[0].length);
  if (correctedWorker.replace(replacement, header[0]) !== worker) throw new Error('Unexpected additional source mutation');
  return {
    source: correctedWorker,
    evidence: {
      pagesUrl: sourceMatch[1],
      oldRelease, newRelease: htmlRelease,
      originalSha256: sha256(worker),
      patchedSha256: sha256(correctedWorker),
      change: 'Only the x-on-haru-release string is updated; SOURCE, startup art, routing and all other bytes are preserved.',
      deployed: false,
    },
  };
}

const usage = 'Usage: node scripts/prepare-worker-release.mjs --source /private/current-on-haru.js --out /private/on-haru-fixed.js --old-release safesave20261123b --pages-url https://530298dd.on-haru-pages.pages.dev';
const cli = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (cli) {
  const args = Object.fromEntries(process.argv.slice(2).flatMap((part, i, all) => part.startsWith('--') && all[i + 1] && !all[i + 1].startsWith('--') ? [[part.slice(2), all[i + 1]]] : []));
  if (!args.source || !args.out || !args['old-release'] || !args['pages-url'] || resolve(args.source) === resolve(args.out)) {
    console.error(usage); process.exitCode = 2;
  } else {
    try {
      const [worker, html, serviceWorker] = await Promise.all([
        readFile(args.source, 'utf8'),
        readFile('public/legacy/index.html', 'utf8'),
        readFile('public/legacy/sw.js', 'utf8'),
      ]);
      const result = prepareWorkerRelease({
        worker, html, serviceWorker,
        expectedOldRelease: args['old-release'], expectedPagesUrl: args['pages-url'],
      });
      await writeFile(args.out, result.source, { flag: 'wx', mode: 0o600 });
      console.log(JSON.stringify({ ...result.evidence, outputPath: resolve(args.out) }, null, 2));
      console.log('NOT DEPLOYED. Upload only after explicit production approval and independent release QA.');
    } catch (error) {
      console.error('ABORT: ' + error.message);
      process.exitCode = 1;
    }
  }
}
