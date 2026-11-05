#!/usr/bin/env node
// Fast, dependency-free structural checks before launching a browser.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const base='public/legacy';
const names={html:'index.html',css:'app.7cb1b71d4eb6.css',js:'runtime/legacy-controllers.9a6fbb5e22cc.js',sw:'sw.js'};
const source={};
for(const [key,path] of Object.entries(names)){
 const file=base+'/'+path;
 if(!fs.existsSync(file))throw new Error('Missing required file: '+file);
 source[key]=fs.readFileSync(file,'utf8');
}
let pass=0,fail=0;
function check(label,ok){
 console.log((ok?'PASS':'FAIL')+' '+label);
 if(ok)pass++;else fail++;
}
const revision=source.html.match(/name="kona-release" content="([a-z0-9]+)"/)?.[1];
check('HTML version has a release marker',Boolean(revision));
check('Service worker uses the same release marker',Boolean(revision&&source.sw.includes(revision)));
check('Runtime JS parses',spawnSync(process.execPath,['--check',base+'/'+names.js],{stdio:'pipe'}).status===0);
check('HTML has the app asset references',source.html.includes(names.css)&&source.html.includes(names.js.split('/').at(-1)));
check('Tutorial uses On_HARU artwork',source.html.includes('assets/onharu-welcome.png')&&!source.html.includes('src="./assets/kona-welcome-sunset.png"'));
check('Short name is optional and collapsed by default',/<details[^>]+id="eventShortNameDetails"[^>]*>/.test(source.html)&&!/<details[^>]+id="eventShortNameDetails"[^>]*\sopen\b/.test(source.html));
check('Short-name form IDs intact', ['eventShortTitle','eventShortPreview','shortTitleScope'].every(id=>source.html.includes('id="'+id+'"')));
check('Create/Edit reset the short-name disclosure',source.js.includes("function clearEventForm(){editEvent=null;$('eventShortNameDetails').open=false")&&source.js.includes("function beginEditEvent(e){if(!e)return;$('eventShortNameDetails').open=false"));
check('No native confirm()/prompt() calls',!/(?<![\w$.])(confirm|prompt)\s*\(/.test(source.js));
check('Branded confirmation dialog is available',source.js.includes('function onHaruDialog(')&&source.css.includes('dialog.onharu-native-replacement'));
check('Capture expandable tags exist',source.js.includes('kona-tag-tray-toggle')&&source.css.includes('top:2px!important;bottom:auto!important'));

const pinGrid=source.html.match(/<style id="onharu-capture-pin-grid-fix">([\\s\\S]*?)<\\/style>/)?.[1]||'';
const captureIds=source.js.match(/const KONA_CAPTURE_TAG_IDS=\\[([^\\]]+)\\]/)?.[1]||'';
check('Capture contains the Remember pin tag',captureIds.includes('"meaning_remember"'));
check('Expanded Capture second row has explicit non-overlapping slots',
  Array.from({length:8},(_,i)=>pinGrid.includes('nth-child('+(i+8)+'){grid-row:2!important;grid-column:'+(i+1)+'!important;}')).every(Boolean));

check('Dark-mode memo text override exists',source.css.includes('/* On_HARU: readable dark-theme note content. */')&&source.css.includes('#F1F7F1'));
check('Review empty state exists',source.js.includes('onharu-review-empty'));
const assets=[...source.html.matchAll(/(?:src|href)="\.\/(assets|icons)\/([^"]+)"/g)].map(m=>base+'/'+m[1]+'/'+m[2]);
check('HTML referenced local images are present',assets.every(x=>fs.existsSync(x)));
console.log('\nStatic UI checks: '+pass+' passed, '+fail+' failed.');
if(fail)process.exitCode=1;
