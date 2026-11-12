import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/legacy/runtime/legacy-controllers.9a6fbb5e22cc.js',import.meta.url),'utf8');
const weekly=source.slice(source.indexOf('function drawWeekly(){'),source.indexOf('\nconst oldRender=renderRecords;',source.indexOf('function drawWeekly(){')));
const helper=name=>source.match(new RegExp('function '+name+'\\([^\\n]+'))[0];
// A small DOM fixture exercises the actual renderer and save handlers without a browser.
class Node {
 constructor(tag,text,cls=''){this.tag=tag;this.text=text||'';this.className=cls;this.children=[];this.attrs={};this.open=false;this.hidden=false;}
 get childNodes(){return this.children;}
 get textContent(){return this.text+this.children.map(x=>x.textContent).join('');}
 set textContent(v){this.text=v;this.children=[];}
 append(...nodes){for(const n of nodes){n.remove();n.parent=this;this.children.push(n);}}
 prepend(...nodes){for(const n of [...nodes].reverse()){n.remove();n.parent=this;this.children.unshift(n);}}
 replaceChildren(...nodes){for(const n of this.children)n.parent=null;this.children=[];this.text='';this.append(...nodes);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}
 before(n){const p=this.parent,i=p.children.indexOf(this);n.remove();n.parent=p;p.children.splice(i,0,n);}
 setAttribute(k,v){this.attrs[k]=v;}
 querySelector(selector){return this.all().find(n=>selector.startsWith('.')?n.className.split(' ').includes(selector.slice(1)):n.tag===selector)||null;}
 all(){return this.children.flatMap(x=>[x,...x.all()]);}
}
function fixture({moments=[],reflection={},saved={},tasks=[],checks={},fail=false,language='en'}={}){
 const panel=new Node('main'),db={settings:{},tasks,checks,days:{'2026-11-09':{reflectionNotes:reflection}},weeklyReflections:{'2026-11-09':{insight:'',action:'',...saved}}};
 let saves=0,renders=0;
 const add=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
 const c={panel,db,date:'2026-11-09',weeklySelectedDate:'2026-11-09',weeklyOffset:0,tutorialPractice:false,
 KonaI18n:{language,dateLocale:language==='ko'?'ko-KR':'en-US',t:s=>s,eventLabel:e=>e.title},
 el:(t,v,c)=>new Node(t,v,c),dayAdd:add,monday:()=> '2026-11-09',nowLocal:()=> '2026-11-09',short:d=>d,fmt:d=>d,
 normalizeWeeklyReflections:()=>{},reviewRecords:d=>d==='2026-11-09'?moments.map(m=>({...m,date:d})):[],weekday:d=>new Date(d+'T12:00:00Z').getUTCDay(),taskKey:(t,d)=>t.id+'|'+(t.repeat==='none'?'single':d),reviewUI:{},reviewUISet:(k,v)=>{c.reviewUI[k]=v},guardedMutation:fn=>{fn();saves++;return true},
 reviewDateGroupHeading:(d,n)=>new Node('h4',d,'review-date-header'),
 reviewDailyFeelingEmoji:()=> '🙂',konaFeeling:()=> 'Calm',reviewFollowupLocalDate:d=>d,
 reviewImportant:r=>!!r.important,validReflectHM:t=>t,reviewRow:(r,opt)=>{assert.equal(opt.weeklyView,true);const n=new Node('article',r.body,'weekly-record');n.recordId=r.id;return n;},
 reflectionResponses:()=>[],appendReflectionContext:()=>{},reviewCanEdit:()=>true,changeDate:d=>{c.changedDate=d;},requestAnimationFrame:fn=>fn(),konaOpenReviewEditor:(d,id)=>{c.opened={date:d,id};},nav:(p,opt)=>{c.navigation={page:p,options:opt};},
 renderRecords:()=>renders++,save:()=>{saves++;return !fail;},
 };
 vm.createContext(c);vm.runInContext(['weeklyReflectionPeriod','weeklyReflectionRecord','commitWeeklyReflection','reflectionHasText','reviewWeekSummary'].map(helper).join('\n')+'\n'+weekly,c);c.drawWeekly();return {c,panel,db,get saves(){return saves;},get renders(){return renders;},all:cls=>panel.all().filter(n=>n.className.split(' ').includes(cls))};
}
test('reflection-first Weekly hides the old timeline and keeps just the primary sections',()=>{
 const f=fixture();
 assert.equal(f.all('weekly-focus-reflection').length,1);
 assert.equal(f.all('weekly-focus-write').length,1);
 assert.equal(f.all('weekly-day').length,0);
 assert.equal(f.all('weekly-compact-meta').length,0);
 assert.equal(f.all('weekly-task-check').length,0);
 assert.ok(f.all('weekly-focus-task-count')[0].textContent.includes('No tasks'));
 assert.equal(f.all('weekly-curated').length,0);
});
test('editor starts closed and offers insight and next step as the two primary inputs',()=>{
 const f=fixture(),toggle=f.all('weekly-reflection-disclosure')[0];
 assert.equal(toggle.open,false);assert.equal(f.all('weekly-reflection-editor')[0].hidden,true);
 assert.equal(f.all('weekly-form-label').length,2);
 assert.equal(f.all('weekly-input-subtitle')[0].textContent,'Next step');
 toggle.open=true;toggle.ontoggle();assert.equal(f.all('weekly-reflection-editor')[0].hidden,false);
});
test('reading view shows insight and action but retains hidden legacy fields in storage',()=>{
 const f=fixture({saved:{insight:'Lesson',action:'Act',scripture:'Private optional field'}});
 assert.equal(f.all('weekly-focus-text')[0].textContent,'Lesson');
 assert.ok(f.all('weekly-focus-next')[0].textContent.includes('Act'));
 assert.equal(f.all('weekly-focus-reflection')[0].textContent.includes('Private optional field'),false);
 assert.equal(f.db.weeklyReflections['2026-11-09'].scripture,'Private optional field');
});
test('autosalving updates preview; failed saves restore the old reading view',()=>{
 const f=fixture({saved:{insight:'Old'}}),input=f.all('rv-journal-main')[0].querySelector('textarea');
 input.value='New';input.oninput();
 assert.equal(f.db.weeklyReflections['2026-11-09'].insight,'New');
 assert.equal(f.all('weekly-focus-text')[0].textContent,'New');
 const bad=fixture({saved:{insight:'Keep'},fail:true}),field=bad.all('rv-journal-main')[0].querySelector('textarea');
 field.value='Lost';field.oninput();
 assert.equal(bad.db.weeklyReflections['2026-11-09'].insight,'Keep');
 assert.equal(bad.all('weekly-focus-text')[0].textContent,'Keep');
 assert.equal(bad.all('rv-save-status')[0].textContent,'Not saved · retry or back up');
});
test('five important records show three first with two in an optional disclosure',()=>{
 const moments=Array.from({length:5},(_,i)=>({id:'n'+i,kind:'capture',noteTitle:'Important '+i,body:'Text '+i,important:true,t:i+1}));
 moments.push({id:'normal',kind:'capture',body:'Not selected',t:30});
 const f=fixture({moments,reflection:{insight:'A Daily reflection'}});
 const section=f.all('weekly-curated')[0];
 const first=section.children.filter(c=>c.className==='weekly-curated-item');
 assert.equal(first.length,3);
 assert.equal(f.all('weekly-curated-more')[0].children.filter(c=>c.className==='weekly-curated-item').length,2);
 assert.equal(section.textContent.includes('Not selected'),false);
 first[0].onclick();assert.ok(f.c.opened.id.startsWith('n'));
});
test('Daily Reflection fills empty highlight slots and opens its original date',()=>{
 const f=fixture({moments:[{id:'important',kind:'capture',body:'A note',important:true}],reflection:{insight:'A daily insight'}});
 const items=f.all('weekly-curated-item');
 assert.equal(items.length,2);
 assert.ok(items[1].textContent.includes('Daily reflection'));
 items[1].onclick();assert.equal(f.c.changedDate,'2026-11-09');
});
test('ordinary notes stay in Daily and are reachable through the date finder',()=>{
 const f=fixture({moments:[{id:'ordinary',kind:'capture',body:'Not highlighted'}]});
 assert.equal(f.all('weekly-curated-item').length,0);
 assert.equal(f.all('weekly-date-link').length,1);
 f.all('weekly-date-link')[0].onclick();assert.equal(f.c.changedDate,'2026-11-09');
});
test('task occurrences become progress; Plan manages them without duplicate checkboxes',()=>{
 const f=fixture({tasks:[
  {id:'one',title:'Submit',repeat:'none',due:'2026-11-11',since:'2026-11-09'},
  {id:'daily',title:'Read',repeat:'daily',since:'2026-11-09',until:'2026-11-15'}
 ],checks:{'daily|2026-11-09':{date:'2026-11-09'},'one|single':{date:'2026-11-11'}}});
 assert.ok(f.all('weekly-focus-task-count')[0].textContent.includes('2/8 completed · 6 remaining'));
 assert.equal(f.all('weekly-task-check').length,0);
 f.all('weekly-open-plan')[0].onclick();
 assert.deepEqual(f.c.navigation,{page:'schedule',options:{sub:'tasks'}});
});
test('empty week cannot be marked completed and week navigation remains intact',()=>{
 const f=fixture({language:'ko'});
 assert.equal(f.all('rv-done')[0].disabled,true);
 assert.equal(f.all('weekly-focus-title')[0].textContent,'이번 주의 돌아봄');
 f.all('weekly-nav-arrow')[0].onclick();
 assert.equal(f.c.weeklyOffset,-1);assert.equal(f.renders,1);
});
