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
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}
 before(n){const p=this.parent,i=p.children.indexOf(this);n.remove();n.parent=p;p.children.splice(i,0,n);}
 setAttribute(k,v){this.attrs[k]=v;}
 querySelector(selector){return this.all().find(n=>selector.startsWith('.')?n.className.split(' ').includes(selector.slice(1)):n.tag===selector)||null;}
 all(){return this.children.flatMap(x=>[x,...x.all()]);}
}
function fixture({moments=[],reflection={},saved={},fail=false,language='en'}={}){
 const panel=new Node('main'),db={settings:{},days:{'2026-11-09':{reflectionNotes:reflection}},weeklyReflections:{'2026-11-09':{insight:'',action:'',...saved}}};
 let saves=0,renders=0;
 const add=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
 const c={panel,db,date:'2026-11-09',weeklySelectedDate:'2026-11-09',weeklyOffset:0,tutorialPractice:false,
 KonaI18n:{language,dateLocale:language==='ko'?'ko-KR':'en-US',t:s=>s,eventLabel:e=>e.title},
 el:(t,v,c)=>new Node(t,v,c),dayAdd:add,monday:()=> '2026-11-09',nowLocal:()=> '2026-11-09',short:d=>d,fmt:d=>d,
 normalizeWeeklyReflections:()=>{},reviewRecords:d=>d==='2026-11-09'?moments:[],
 reviewDateGroupHeading:(d,n)=>new Node('h4',d,'review-date-header'),
 reviewDailyFeelingEmoji:()=> '🙂',konaFeeling:()=> 'Calm',reviewFollowupLocalDate:d=>d,
 reviewImportant:r=>!!r.important,validReflectHM:t=>t,reviewRow:(r,opt)=>{assert.equal(opt.weeklyView,true);const n=new Node('article',r.body,'weekly-record');n.recordId=r.id;return n;},
 reflectionResponses:()=>[],appendReflectionContext:()=>{},reviewCanEdit:()=>true,changeDate:()=>{},
 renderRecords:()=>renders++,save:()=>{saves++;return !fail;},
 };
 vm.createContext(c);vm.runInContext(['weeklyReflectionPeriod','weeklyReflectionRecord','commitWeeklyReflection','reflectionHasText','reviewWeekSummary'].map(helper).join('\n')+'\n'+weekly,c);c.drawWeekly();return {c,panel,db,get saves(){return saves;},get renders(){return renders;},all:cls=>panel.all().filter(n=>n.className.split(' ').includes(cls))};
}
test('weekly editor and raw records start closed; no default fixed-three selection',()=>{
 const f=fixture({moments:[{id:'a',kind:'capture',body:'unmarked'}]});
 const disclosure=f.all('weekly-reflection-disclosure')[0],editor=f.all('weekly-reflection-editor')[0];
 assert.equal(disclosure.open,false);assert.equal(editor.hidden,true);
 disclosure.open=true;disclosure.ontoggle();assert.equal(editor.hidden,false);
 disclosure.open=false;disclosure.ontoggle();assert.equal(editor.hidden,true);
 assert.equal(editor.parent,f.panel);
 assert.equal(f.all('weekly-other-records')[0].open,false);
 assert.equal(f.all('weekly-important-records').length,0);
 assert.equal(f.all('weekly-reflection-toggle')[0].textContent,'Reflect');
});
test('saved daily reflection stays complete before highlights; no duplicated records',()=>{
 const text='회고 전체 내용\n'.repeat(160),moments=[{id:'a',kind:'capture',body:'priority',important:true},{id:'b',kind:'check',body:'raw',phase:'morning'},{id:'c',kind:'anchor',body:'intention'}];
 const f=fixture({moments,reflection:{insight:text,action:'response',followups:[{text:'later',createdAt:'2026-11-10'}]}});
 assert.equal(f.all('reflection-saved-text')[0].textContent,text);
 const day=f.all('weekly-day')[0];assert.ok(day.children.indexOf(f.all('weekly-daily-reflection')[0])<day.children.indexOf(f.all('weekly-important-records')[0]));
 assert.deepEqual(f.all('weekly-important-records')[0].all().filter(n=>n.recordId).map(n=>n.recordId),['a']);
 assert.deepEqual(f.all('weekly-other-records')[0].all().filter(n=>n.recordId).map(n=>n.recordId),['b']);
 assert.equal(f.all('weekly-anchor').length,1);assert.equal(f.all('weekly-day-mood').length,0);
});
test('end-of-day mood only; linked schedule chip once across highlighted and raw notes',()=>{
 const link={scheduleId:'w',reviewEvent:{title:'Worship',start:'09:30',end:'10:30'}},f=fixture({moments:[{id:'a',kind:'capture',body:'one',important:true,...link},{id:'b',kind:'capture',body:'two',...link},{id:'n',kind:'check',phase:'night',feeling:'Calm',energy:3}]});
 assert.equal(f.all('weekly-day-mood').length,1);assert.equal(f.all('weekly-schedule-chip').length,1);assert.equal(f.all('weekly-schedule-chip')[0].textContent,'Worship · 09:30–10:30');
});
test('weekly input autosaves; completion saves; failed writes restore the prior data',()=>{
 const f=fixture(),input=f.all('rv-journal-main')[0].querySelector('textarea');input.value='weekly insight';input.oninput();assert.equal(f.db.weeklyReflections['2026-11-09'].insight,'weekly insight');assert.equal(f.all('rv-done')[0].disabled,false);f.all('rv-done')[0].onclick();assert.equal(f.db.weeklyReflections['2026-11-09'].reflected,true);assert.equal(f.renders,1);
 const broken=fixture({saved:{insight:'kept'},fail:true}),field=broken.all('rv-journal-main')[0].querySelector('textarea');field.value='unsaved';field.oninput();assert.equal(broken.db.weeklyReflections['2026-11-09'].insight,'kept');assert.equal(broken.all('rv-save-status')[0].textContent,'Not saved · retry or back up');
});
test('empty week completion disabled; week navigation and Korean control remain available',()=>{
 const f=fixture({language:'ko'});assert.equal(f.all('rv-done')[0].disabled,true);assert.equal(f.all('weekly-reflection-toggle')[0].textContent,'회고 쓰기');f.all('weekly-nav-arrow')[0].onclick();assert.equal(f.c.weeklyOffset,-1);assert.equal(f.renders,1);
});
