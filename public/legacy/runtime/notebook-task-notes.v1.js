/* One source record for captures, task notes and date-free notebook entries.
   Additive flags stay in normal backups; source IDs and links do not change. */
function konaNotebookRecords(data){
 return Object.entries(data.days||{}).flatMap(([date,day])=>(day.quickCaptureEntries||[]).filter(q=>q.notebook===true).map(q=>({date,note:q}))).sort((a,b)=>String(b.note.updatedAt||b.note.createdAt||'').localeCompare(String(a.note.updatedAt||a.note.createdAt||'')));
}
function konaTaskMemoRecords(data,taskId){
 return Object.entries(data.days||{}).flatMap(([date,day])=>(day.quickCaptureEntries||[]).filter(q=>q.taskId===taskId).map(q=>({date,note:q}))).sort((a,b)=>String(b.note.createdAt||'').localeCompare(String(a.note.createdAt||'')));
}
(function(){
 'use strict';
 const word=(ko,en)=>KonaI18n.language==='ko'?ko:en;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 const button=(text,action,cls='mini-btn')=>{const b=node('button',text,cls);b.type='button';b.onclick=e=>{e.stopPropagation();action()};return b};
 const failure=()=>word('메모를 저장하지 못했어요. 입력한 내용은 그대로예요.','Could not save. Your text is still here.');
 const locate=(d,id)=>db.days[d]?.quickCaptureEntries?.find(q=>q.id===id);
 let expanded=true,query='';
 function refresh(){render();if(page==='records')refreshNotebook()}
 function saveEntry(d,text,{entry=null,task=null,notebook=false}={}){
  return guardedMutation(()=>{
   if(entry){const q=locate(d,entry.id);if(!q)throw Error('Missing note');q.text=text;q.updatedAt=new Date().toISOString();}
   else{const stamp=new Date().toISOString();day(d).quickCaptureEntries??=[];day(d).quickCaptureEntries.push({id:uid(),title:'',text,createdAt:stamp,updatedAt:stamp,time:timeLocal(),date:d,scheduleId:'',scheduleTitle:task?.title||KonaI18n.t('Personal note'),scheduleTime:'',tags:[],important:false,notebook,...(task?{taskId:task.id,taskTitle:task.title,taskOccurrence:taskKey(task,d)}:{})})}
  },failure());
 }
 function editEntry(d,entry=null,{task=null,notebook=false,after=refresh}={}){
  const title=task?word('할 일 진행 메모','Task progress note'):word(entry?'메모 수정':'메모 작성',entry?'Edit note':'New note');
  openKonaInput({title,value:entry?.text||'',allowEmpty:!!entry?.title,multiline:true,placeholder:task?word('어떻게 진행했는지, 무엇을 했는지 남겨주세요.','Record how you approached the task and what you did.'):word('날짜와 관계없이 보관할 내용을 적어주세요.','Write something to keep, independent of a date.'),onSave:text=>{if(!saveEntry(d,text,{entry,task,notebook}))return false;after();return true}});
 }
 function openNotebook(){
  nav('records');document.getElementById('rev-archive')?.click();expanded=true;refreshNotebook();
  requestAnimationFrame(()=>document.getElementById('notebookSection')?.scrollIntoView({block:'start',behavior:'smooth'}));
 }
 window.konaOpenNotebook=openNotebook;
 function restoreDated(d,id){
  if(!guardedMutation(()=>{const q=locate(d,id);if(!q)throw Error('Missing note');q.notebook=false;q.updatedAt=new Date().toISOString()},failure()))return;
  closeSheet('timeNotesModal');refresh();toast(word('작성한 날의 기록으로 옮겼어요.','Moved back to the original date.'));
 }
 function showNotebookEntry(d,id){
  const q=locate(d,id);if(!q)return;
  const body=document.getElementById('timeNotesBody');body.replaceChildren();document.getElementById('timeNotesTitle').textContent=word('메모','Notebook');document.getElementById('timeNotesStatus').textContent=word('날짜 없이 보관','Independent of a date');
  if(q.title)body.append(node('h3',q.title,'notebook-note-title'));
  body.append(node('p',q.text,'notebook-note-body'));
  const actions=node('div',undefined,'notebook-actions');
  actions.append(button(word('수정','Edit'),()=>editEntry(d,q,{after:()=>{refresh();showNotebookEntry(d,id)}})),button(word('제목 수정','Edit title'),()=>openKonaInput({title:word('메모 제목','Note title'),value:q.title||'',allowEmpty:true,onSave:title=>{if(!guardedMutation(()=>{locate(d,id).title=title;locate(d,id).updatedAt=new Date().toISOString()},failure()))return false;refresh();showNotebookEntry(d,id);return true}})),button(word('작성한 날의 기록으로 옮기기','Move to original date'),()=>restoreDated(d,id)),button(word('삭제','Delete'),async()=>{if(!await onHaruConfirm(word('이 메모를 삭제할까요?','Delete this note?')))return;if(guardedMutation(()=>{day(d).quickCaptureEntries=day(d).quickCaptureEntries.filter(x=>x.id!==id)},failure())){closeSheet('timeNotesModal');refresh()}}));body.append(actions);openSheet('timeNotesModal');
 }
 function refreshNotebook(){
  const archive=document.getElementById('archive-search');if(!archive)return;
  let section=document.getElementById('notebookSection');
  if(!section){section=node('section',undefined,'notebook-section');section.id='notebookSection';section.setAttribute('aria-label',word('날짜 없는 메모','Date-free notebook'));archive.prepend(section)}
  const all=konaNotebookRecords(db);
  section.setAttribute('aria-label',word('날짜 없는 메모','Date-free notebook'));section.replaceChildren();const head=node('div',undefined,'notebook-heading');const toggle=button(word('메모','Notebook')+' · '+all.length+(expanded?' ⌃':' ⌄'),()=>{expanded=!expanded;refreshNotebook()},'notebook-toggle');toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-controls','notebookContents');head.append(toggle,button(word('＋ 메모 작성','＋ New note'),()=>editEntry(nowLocal(),null,{notebook:true,after:()=>{expanded=true;refresh()}})));section.append(head);
  const content=node('div');content.id='notebookContents';content.hidden=!expanded;section.append(content);
  content.append(node('p',word('날짜와 관계없이 보관하는 메모예요.','Keep notes here independently of any date.'),'notebook-help'));
  if(all.length){const search=node('input');search.type='search';search.className='field';search.placeholder=word('메모 검색','Search notebook');search.setAttribute('aria-label',search.placeholder);search.value=query;search.oninput=()=>{query=search.value;drawList()};content.append(search)}
  const list=node('div',undefined,'notebook-list');content.append(list);
  function drawList(){list.replaceChildren();const records=konaNotebookRecords(db).filter(({note:q})=>[q.title,q.text,...(q.tags||[])].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()));for(const {date:d,note:q}of records){const b=button('',()=>showNotebookEntry(d,q.id),'notebook-row');if(q.title)b.append(node('strong',q.title));b.append(node('span',q.text,'notebook-preview'));if(q.taskTitle)b.append(node('small',word('할 일 · ','Task · ')+q.taskTitle));list.append(b)}if(!records.length)list.append(node('p',all.length?word('검색 결과가 없어요.','No matching notes.'):word('메모를 작성하거나 캡처한 기록을 이곳으로 옮겨보세요.','Write a note here or move a captured note into this notebook.'),'notebook-empty'))}
  drawList();
 }
 function showTaskNotes(task,d){
  const entries=konaTaskMemoRecords(db,task.id),body=document.getElementById('timeNotesBody');body.replaceChildren();document.getElementById('timeNotesTitle').textContent=task.title;document.getElementById('timeNotesStatus').textContent=word('어떻게 했는지 남기는 진행 메모','A record of how you did the task');
  body.append(button(word('＋ 진행 메모 추가','＋ Add progress note'),()=>editEntry(d,null,{task,after:()=>{refresh();showTaskNotes(task,d)}})));
  body.append(node('p',word('작성 날짜 · ','Note date · ')+fmt(d),'notebook-help'));
  if(!entries.length)body.append(node('p',word('진행한 방법이나 결과를 남겨두면 나중에 다시 확인할 수 있어요.','Keep the approach and outcome here so you can return to them later.'),'notebook-empty'));
  for(const {date:recordDate,note:q} of entries){const row=node('article',undefined,'task-note-entry');row.append(node('small',fmt(recordDate)),node('p',q.text,'notebook-note-body'),button(word('수정','Edit'),()=>editEntry(recordDate,q,{task,after:()=>{refresh();showTaskNotes(task,d)}})));body.append(row)}
  openSheet('timeNotesModal');
 }
 window.konaTaskMemoButton=function(task,d){const count=konaTaskMemoRecords(db,task.id).filter(r=>r.date===d).length;const b=button(word('메모','Note')+(count?' '+count:''),()=>showTaskNotes(task,d),'task-execution-note');b.setAttribute('aria-label',word('진행 메모: ','Progress notes: ')+task.title);return b};
 const originalTaskRow=taskRow;taskRow=function(task,d,options){const row=originalTaskRow(task,d,options);row.append(window.konaTaskMemoButton(task,d));return row};
 const originalManager=renderSchedule;renderSchedule=function(){const result=originalManager.apply(this,arguments);const tasks=db.tasks.slice().sort((a,b)=>a.title.localeCompare(b.title,'ko'));document.querySelectorAll('#taskManageList > .record-item').forEach((row,i)=>{if(tasks[i])row.insertBefore(window.konaTaskMemoButton(tasks[i],date),row.querySelector('.buttons'))});return result};
 const originalMetadata=konaReviewNoteMetadata;konaReviewNoteMetadata=function(entry,d,changed){const wrap=originalMetadata(entry,d,changed);wrap.append(button(word('メ모로 옮기기 · 날짜 없이 보관','Move to notebook · no date'),()=>{if(!guardedMutation(()=>{const q=locate(d,entry.id);if(!q)throw Error('Missing note');q.notebook=true;q.updatedAt=new Date().toISOString()},failure()))return;openNotebook();toast(word('날짜 없는 메모로 옮겼어요.','Moved to your date-free notebook.'))},'notebook-move-action'));return wrap};
 function composer(){const input=document.getElementById('qc-text');if(!input)return;let label=document.getElementById('captureNotebookChoice');if(!label){label=node('label',undefined,'capture-notebook-choice');label.id='captureNotebookChoice';const cb=node('input');cb.type='checkbox';cb.id='captureToNotebook';label.append(cb,node('span',word('날짜 없는 메모에 저장','Save to date-free notebook')));input.before(label);cb.onchange=()=>input.dispatchEvent(new Event('input',{bubbles:true}))}document.getElementById('captureToNotebook').checked=!!db.days[date]?.qcDraft?.notebook;}
 const originalRecords=renderRecords;renderRecords=function(){const result=originalRecords.apply(this,arguments);refreshNotebook();return result};
 const originalRender=render;render=function(){const result=originalRender.apply(this,arguments);composer();return result};
 composer();if(page==='records')refreshNotebook();if(page==='today'||page==='capture'||page==='schedule')render();
})();
