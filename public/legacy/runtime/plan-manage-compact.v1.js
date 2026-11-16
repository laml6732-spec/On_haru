/* Compact management lists. Display-only adaptation: preserves legacy edit, delete,
   date filters, repeat semantics, stored task kinds, and browser data. */
(function(){
  'use strict';
  if(typeof renderSchedule!=='function')return;
  const originalRenderSchedule=renderSchedule;
  const label=(ko,en)=>KonaI18n.language==='ko'?ko:en;
  function decorateManager(){
    const panel=document.getElementById('page-schedule');
    if(!panel)return;
    const taskItems=[...panel.querySelectorAll('#taskManageList > .record-item')];
    const sorted=db.tasks.slice().sort((a,b)=>a.title.localeCompare(b.title,'ko'));
    taskItems.forEach((item,i)=>{
      const t=sorted[i];if(!t)return;
      item.classList.add('pm-task-row');
      const title=item.querySelector('.grow.ellip');
      if(title){
        title.textContent=t.title; // No generic notepad or prayer emoji in task list.
        title.classList.remove('ellip');
        title.classList.add('pm-item-title');
        title.title=t.title;
      }
      const meta=item.querySelector('.meta-r');
      if(meta){
        // A one-off task with no due date is carried forward until done.
        // Empty metadata is intentional; no "No date" or dash placeholder.
        let description='';
        if(t.repeat==='daily')description=label('매일','Daily');
        else if(t.repeat==='weekly')description=label('매주','Weekly')+(t.days?.length?' · '+t.days.map(x=>KDAY[x]).join(' · '):'');
        else if(t.due)description=short(t.due);
        meta.textContent=description;
        meta.hidden=!description;
        meta.classList.add('pm-meta');
      }
      const del=item.querySelector('.buttons .iconbtn');
      if(del){
        del.classList.add('pm-delete');
        del.setAttribute('aria-label',label('할 일 삭제: ','Delete task: ')+t.title);
      }
    });
    const eventItems=[...panel.querySelectorAll('#eventManageList > .record-item')];
    const events=dayEvents(date);
    eventItems.forEach((item,i)=>{
      const e=events[i];if(!e)return;
      item.classList.add('pm-event-row');
      const title=item.querySelector('.grow .ellip');
      if(title){
        title.classList.remove('ellip');
        title.classList.add('pm-item-title');
        title.title=title.textContent.trim();
      }
      const end=item.querySelector('.grow .sub');
      if(end){
        end.textContent=label('종료 ','Until ')+e.end+(e.overridden?label(' · 이날 변경',' · Changed for this day'):'');
      }
      // Original row click and keyboard events still open edit/delete options.
    });
    const taskTitle=panel.querySelector('#editorTasksArea .sectionhead h2');
    if(taskTitle)taskTitle.textContent=label('전체 할 일 · ','All tasks · ')+db.tasks.length;
    const eventTitle=panel.querySelector('#editorEventsArea .sectionhead h2');
    if(eventTitle)eventTitle.textContent=label('일정 · ','Schedule · ')+events.length;
    const count=document.getElementById('eventCount');if(count)count.hidden=true;
    for(const [id,ko,en] of [['addEventBtn','＋ 추가','＋ Add'],['addTaskBtn','＋ 추가','＋ Add']]){
      const button=document.getElementById(id);
      if(button){button.textContent=label(ko,en);button.classList.add('pm-add-action')}
    }
    const tutorial=document.getElementById('tutorialButton');
    if(tutorial){
      tutorial.textContent='?';
      tutorial.setAttribute('aria-label',label('사용 방법 보기','Open tutorial'));
      tutorial.title=label('사용 방법 보기','Tutorial');
      tutorial.classList.add('pm-tutorial');
    }
    const emptyTasks=panel.querySelector('#taskManageList > .dash');
    if(emptyTasks)emptyTasks.textContent=label('등록된 할 일이 없어요.','No tasks yet.');
    const emptyEvents=panel.querySelector('#eventManageList > .dash');
    if(emptyEvents)emptyEvents.textContent=label('이날의 일정이 없어요.','No events for this day.');
  }
  renderSchedule=function(){
    const result=originalRenderSchedule.apply(this,arguments);
    decorateManager();
    return result;
  };
  // Initial view can be restored from browser history before this file loads.
  if(typeof page!=='undefined'&&page==='schedule')decorateManager();
})();