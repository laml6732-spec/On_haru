// No-dependency regression for note title vs linked schedule display.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/legacy/runtime/legacy-controllers.9a6fbb5e22cc.js',import.meta.url),'utf8');
function getFunction(name){
 const match=source.match(new RegExp('^function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?^\\}','m'));
 assert.ok(match,'Missing '+name);
 return match[0];
}
const api=vm.runInNewContext([
 getFunction('archiveSemanticGroup'),
 getFunction('reviewSameTitleAsSchedule'),
 getFunction('reviewArchivePreview'),
 '({archiveSemanticGroup,reviewSameTitleAsSchedule,reviewArchivePreview})'
].join('\n'));
const cases=[
 ['Same user title and schedule',{kind:'capture',scheduleId:'sg',scheduleLabel:'Small Group',noteTitle:'Small Group',body:'Meeting reflection'},'Small Group\nMeeting reflection',false],
 ['Case/spacing equivalent',{kind:'capture',scheduleId:'sg',scheduleLabel:'Small Group',noteTitle:'  small  GROUP ',body:'Meeting reflection'},'small  GROUP\nMeeting reflection',false],
 ['Distinct user title',{kind:'capture',scheduleId:'sg',scheduleLabel:'Small Group',noteTitle:'Community reflection',body:'Meeting reflection'},'Community reflection\nMeeting reflection',true],
 ['Untitled linked note',{kind:'capture',scheduleId:'sg',scheduleLabel:'Small Group',noteTitle:'',body:'Meeting reflection'},'Meeting reflection',true],
 ['Tag-only linked note',{kind:'capture',scheduleId:'sg',scheduleLabel:'Small Group',noteTitle:'',title:'Small Group',body:'',tags:['meaning_insight']},'',true],
 ['Title-only linked note',{kind:'capture',scheduleId:'sg',scheduleLabel:'Small Group',noteTitle:'Reflection',title:'Small Group',body:''},'Reflection',true],
 ['Tag-only personal note',{kind:'capture',scheduleId:'',scheduleLabel:'Personal note',noteTitle:'',title:'Personal note',body:'',tags:['meaning_insight']},'Personal note',false]
];
for(const [label,record,preview,showSchedule] of cases){
 assert.equal(api.reviewArchivePreview(record),preview,label+' preview');
 assert.equal(api.archiveSemanticGroup(record)==='schedule'&&!api.reviewSameTitleAsSchedule(record),showSchedule,label+' schedule');
}
for(const marker of [
 "const title=grouped&&sameAsSchedule?'':String(record.noteTitle||'').trim();",
 "if(!grouped&&record.scheduleId&&!sameAsSchedule)body.append",
 "const text=reviewArchivePreview(record);",
 "const linkedSchedule=archiveSemanticGroup(record)==='schedule'&&!reviewSameTitleAsSchedule(record)"
])assert.ok(source.includes(marker),'Renderer integration missing: '+marker);
console.log('PASS: 7 title/schedule cases and Records/Review renderer integration');
