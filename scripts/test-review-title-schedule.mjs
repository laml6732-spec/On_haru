// No-dependency regression: note titles, schedule context, record types, and searchable tags.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/legacy/runtime/legacy-controllers.9a6fbb5e22cc.js',import.meta.url),'utf8');
new vm.Script(source,{filename:'legacy-controllers.js'}); // Syntax check, no app execution.
function getFunction(name){
 const match=source.match(new RegExp('^function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?^\\}','m'));
 assert.ok(match,'Missing '+name);
 return match[0];
}
const names=['archiveSemanticGroup','archivePracticeName','reviewSameTitleAsSchedule','archiveRecordContextKey',
 'archiveRecordType','archiveRecordTypeLabel','archiveRecordTagLabel','archiveRecordText',
 'reviewArchivePreview','archiveRecordSearchText'];
const tags=[['meaning_insight','💡 Insight'],['meaning_question','❓ Question'],['meaning_listening','🐑 Hearing God’s Voice']];
const api=vm.runInNewContext([
 ...names.map(getFunction),'({'+names.join(',')+'})'
].join('\n'),{KONA_NOTE_TAGS:tags,archiveMoodText:en=>en});

const cases=[
 ['Identical explicit title',{kind:'capture',scheduleId:'sg',scheduleLabel:'Small Group',noteTitle:'Small Group',body:'Meeting reflection'},'Small Group\nMeeting reflection',false],
 ['Case/space equivalent title',{kind:'capture',scheduleId:'sg',scheduleLabel:'Small Group',noteTitle:'  small  GROUP ',body:'Meeting reflection'},'small  GROUP\nMeeting reflection',false],
 ['Distinct explicit title',{kind:'capture',scheduleId:'sg',scheduleLabel:'Small Group',noteTitle:'Community reflection',body:'Meeting reflection'},'Community reflection\nMeeting reflection',true],
 ['Untitled linked note',{kind:'capture',scheduleId:'sg',scheduleLabel:'Small Group',noteTitle:'',body:'Meeting reflection'},'Meeting reflection',true],
 ['Tag-only linked note',{kind:'capture',scheduleId:'sg',scheduleLabel:'Small Group',noteTitle:'',title:'Small Group',body:'',tags:['meaning_insight']},'',true],
 ['Title-only linked note',{kind:'capture',scheduleId:'sg',scheduleLabel:'Small Group',noteTitle:'Reflection',title:'Small Group',body:''},'Reflection',true],
 ['Tag-only personal note',{kind:'capture',scheduleId:'',scheduleLabel:'Personal note',noteTitle:'',title:'Personal note',body:'',tags:['meaning_insight']},'Personal note',false]
];
for(const [label,record,preview,showSchedule] of cases){
 const snapshot=JSON.stringify(record);
 assert.equal(api.reviewArchivePreview(record),preview,label+' preview');
 assert.equal(api.archiveSemanticGroup(record)==='schedule'&&!api.reviewSameTitleAsSchedule(record),showSchedule,label+' metadata');
 assert.equal(JSON.stringify(record),snapshot,label+' changed raw record');
}
for(const [kind,type] of [['capture','note'],['event','note'],['free','note'],['class','note'],['check','checkin'],['reflection','reflection'],['weekly-reflection','reflection'],['session','session']]){
 assert.equal(api.archiveRecordType({kind}),type,kind+' type');
}
const tagged={kind:'capture',scheduleId:'sg',scheduleLabel:'Small Group',noteTitle:'Community',body:'Thought',recordedTime:'14:43',tags:['meaning_insight','meaning_question']};
assert.ok(api.archiveRecordSearchText(tagged).includes('insight'),'tag label not searchable');
assert.ok(api.archiveRecordSearchText(tagged).includes('question'),'secondary tag label not searchable');
assert.ok(api.archiveRecordSearchText(tagged).includes('small group'),'schedule not searchable');
assert.ok(api.archiveRecordSearchText(tagged).includes('community'),'title not searchable');
assert.equal(api.archiveRecordTagLabel('meaning_listening'),'🐑 Hearing God’s Voice');
assert.equal(api.archiveRecordContextKey({kind:'capture',scheduleId:'sg',scheduleLabel:'Small Group'}),'schedule:sg');
assert.equal(api.archiveRecordContextKey({kind:'meal',scheduleLabel:'Dinner'}),'schedule-label:Dinner');
assert.equal(api.archiveRecordContextKey({kind:'capture',scheduleId:'',scheduleLabel:'Personal note'}),'none');
for(const marker of [
 "const title=grouped&&sameAsSchedule?'':String(record.noteTitle||'').trim();",
 "if(!grouped&&record.scheduleId&&!sameAsSchedule)body.append",
 "const {title,body}=archiveRecordText(record);",
 "for(const record of dayRecords)addArchiveRecord(record);",
 "archiveMeaning!=='starred'||archiveManuallySaved(r)",
 "archiveRecordSearchText(r).includes"
])assert.ok(source.includes(marker),'Renderer integration missing: '+marker);
console.log('PASS: 7 title cases, 8 kind cases, searchable tags, read-only data, and Records integration');
