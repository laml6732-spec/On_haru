import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareWorkerRelease } from './prepare-worker-release.mjs';

const currentSource = 'https://530298dd.on-haru-pages.pages.dev';
const currentHeader = 'safesave20261123b';
const appRelease = 'prayerrecords20261123a';
const html = '<meta name="kona-release" content="' + appRelease + '">';
const serviceWorker = "const RELEASE='" + appRelease + "';";
const worker = [
  '// exact real Worker syntax but with tiny synthetic content',
  'const SOURCE = "' + currentSource + '";',
  'const STARTUP_ART={"morning":"sample-art-not-to-change"};',
  'addEventListener("fetch", event => {event.respondWith(serve(event.request));});',
  'async function serve(request) {',
  'const headers = new Headers();',
  'headers.set("x-on-haru-deployment", "pages-release-pinned");',
  'headers.set("x-on-haru-release", "' + currentHeader + '");',
  'return new Response("synthetic", {headers});',
  '}',
].join('\n');
const input = (overrides = {}) => ({
  worker, html, serviceWorker, pinnedHtml: html, pinnedServiceWorker: serviceWorker,
  expectedOldRelease: currentHeader, expectedPagesUrl: currentSource,
  ...overrides,
});

test('only one header literal changes; page pin, image data and other bytes are identical', () => {
  const { source, evidence } = prepareWorkerRelease(input());
  assert.equal(source.split('x-on-haru-release').length - 1, 1);
  assert.equal(source.replace('headers.set("x-on-haru-release", "' + appRelease + '");',
    'headers.set("x-on-haru-release", "' + currentHeader + '");'), worker);
  assert.equal(evidence.oldRelease, currentHeader);
  assert.equal(evidence.newRelease, appRelease);
  assert.equal(evidence.pagesUrl, currentSource);
  assert.equal(evidence.deployed, false);
  assert.notEqual(evidence.originalSha256, evidence.patchedSha256);
});
test('abort when HTML and PWA service-worker releases disagree', () => {
  assert.throws(() => prepareWorkerRelease(input({ serviceWorker: "const RELEASE='oldversion';" })), /releases differ/);
});
test('abort if current deployment release or Pages pin has changed', () => {
  assert.throws(() => prepareWorkerRelease(input({ expectedOldRelease: 'other' })), /changed since backup/);
  assert.throws(() => prepareWorkerRelease(input({ expectedPagesUrl: 'https://wrong.on-haru-pages.pages.dev' })), /Pinned Pages URL changed/);
});
test('abort if duplicate header, header missing or unknown bridge', () => {
  assert.throws(() => prepareWorkerRelease(input({ worker: worker + '\nheaders.set("x-on-haru-release", "other");' })), /exactly once/);
  assert.throws(() => prepareWorkerRelease(input({ worker: worker.replace('x-on-haru-release', 'x-wrong-release') })), /exactly once/);
  assert.throws(() => prepareWorkerRelease(input({ worker: worker.replace('pages-release-pinned', 'other') })), /Unexpected Worker bridge/);
});
test('abort for already matching header or missing required pinned version', () => {
  assert.throws(() => prepareWorkerRelease(input({ worker: worker.replace(currentHeader, appRelease), expectedOldRelease: appRelease })), /already matches/);
  assert.throws(() => prepareWorkerRelease(input({ expectedPagesUrl: null })), /required/);
});

test('rejects branch release newer than the immutable Pages source', () => {
  const oldPage='<meta name="kona-release" content="prayerrecords20261123a">';
  const oldSW="const RELEASE='prayerrecords20261123a';";
  assert.throws(() => prepareWorkerRelease(input({
    pinnedHtml:oldPage,pinnedServiceWorker:oldSW
  })),/Pinned Pages release does not match local/);
  assert.throws(() => prepareWorkerRelease(input({pinnedHtml:null})),/snapshots are required/);
});
