import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAsset } from './verify-live-release.mjs';

const release = 'moodpalettev120261105';
const baseURL = 'https://on-haru.laml6732.workers.dev/';
const html = Buffer.from('<meta name="kona-release" content="' + release + '">');
const sw = Buffer.from("const RELEASE='" + release + "';");
const check = (changes = {}) => verifyAsset({
  path: '', local: html, actual: html, release, status: 200,
  finalURL: baseURL, baseURL, workerRelease: null, ...changes,
});

test('exact deployed HTML hash and embedded release succeed without optional Worker header', () => {
  const result = check();
  assert.equal(result.ok, true);
  assert.equal(result.hashMatch, true);
  assert.equal(result.releaseHeaderPresent, false);
  assert.equal(result.bodyReleaseMatch, true);
});
test('when a Worker release header exists, it must match expected release', () => {
  assert.equal(check({ workerRelease: release }).ok, true);
  assert.equal(check({ workerRelease: 'wrong-version' }).ok, false);
});
test('release attestation fails for altered deployment bytes', () => {
  assert.equal(check({ actual: Buffer.from(html.toString().replace('moodpalette', 'oldpalette')) }).ok, false);
});
test('release attestation fails for wrong status, origin and asset path', () => {
  assert.equal(check({ status: 404 }).ok, false);
  assert.equal(check({ finalURL: 'https://on-haru-pages.pages.dev/legacy/' }).ok, false);
  assert.equal(check({ finalURL: baseURL + 'legacy/' }).ok, false);
});
test('HTML marker must be present even when matching local bytes', () => {
  const unmarked = Buffer.from('<meta name="kona-release" content="stale">');
  assert.equal(check({ local: unmarked, actual: unmarked }).ok, false);
});
test('service-worker embedded release marker is verified in addition to hash', () => {
  const url = baseURL + 'sw.js?rev=' + release;
  const args = { path: 'sw.js', local: sw, actual: sw, release,
    status: 200, finalURL: url, baseURL, workerRelease: null };
  assert.equal(verifyAsset(args).ok, true);
  const stale = Buffer.from("const RELEASE='stale';");
  assert.equal(verifyAsset({ ...args, local: stale, actual: stale }).ok, false);
});
test('matching CSS content verifies with same-origin rev query but without header', () => {
  const css=Buffer.from('body{color:red}');
  const r=verifyAsset({path:'app.7cb1b71d4eb6.css',local:css,actual:css,release,status:200,
    finalURL:baseURL+'app.7cb1b71d4eb6.css?rev='+release,baseURL,workerRelease:null});
  assert.equal(r.ok,true);
});
