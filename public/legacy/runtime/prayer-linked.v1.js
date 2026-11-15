/* On_HARU prayer library + task linking: additive compatibility layer.
   No data reset or schema replacement; legacy answered/note values remain intact. */
(function(){
  'use strict';
  const modal=document.getElementById('focusLibraryModal');
  const taskForm=document.getElementById('taskForm');
  const linkCheck=document.getElementById('taskAlsoPrayer');
  const linkTarget=document.getElementById('taskLinkedPrayerTarget');
  const linkOptions=document.getElementById('taskPrayerLinkOptions');
  if(!modal||!taskForm||!linkCheck||!linkTarget||!linkOptions)return;

  const local=(ko,en)=>KonaI18n.language==='ko'?ko:en;
  const action=(label,cls,handler)=>{
    const b=document.createElement('button');b.type='button';b.className=cls||'';b.textContent=label;
    b.addEventListener('click',handler);return b;
  };
  const node=(tag,cls,text)=>{
    const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;
    return n;
  };
  const storedResponses=p=>Array.isArray(p.responseLogs)?p.responseLogs:[];
  const hasResponse=p=>Boolean(p.answered)||storedResponses(p).length>0;
  const prayerTitle=p=>p.title||local('제목 없음','Untitled');
  const linkedTasks=p=>db.tasks.filter(t=>t.linkedPrayerId===p.id);
  const when=d=>d?short(d):'';
  const write=(mutate,success)=>{
    if(!guardedMutation(mutate,local('변경 사항을 저장하지 못했어요.','Could not save changes.')))return false;
    if(success)toast(success);
    return true;
  };
  let filter='all',search='',selectedId='',addOpen=false;
  const saveLabel=()=>local('저장','Save');

  function refreshLinkOptions(selected){
    const old=selected===undefined?linkTarget.value:selected;
    linkTarget.replaceChildren(new Option(local('새 기도제목 생성','Create new prayer request'),'new'));
    for(const p of db.prayers){
      if(p.answered&&old!==p.id)continue;
      linkTarget.add(new Option(p.title||local('제목 없음','Untitled'),p.id));
    }
    linkTarget.value=[...linkTarget.options].some(opt=>opt.value===old)?old:'new';
  }
  function syncLinkVisibility(){
    linkOptions.hidden=!linkCheck.checked;
    linkTarget.disabled=!linkCheck.checked;
    linkCheck.setAttribute('aria-expanded',String(linkCheck.checked));
  }
  linkCheck.addEventListener('change',()=>{refreshLinkOptions();syncLinkVisibility()});

  const oldClear=clearTaskForm,oldEdit=beginEditTask;
  clearTaskForm=function(){
    oldClear.apply(this,arguments);
    linkCheck.checked=false;refreshLinkOptions('new');syncLinkVisibility();
  };
  beginEditTask=function(t){
    oldEdit.apply(this,arguments);
    linkCheck.checked=Boolean(t.linkedPrayerId&&db.prayers.some(p=>p.id===t.linkedPrayerId));
    refreshLinkOptions(t.linkedPrayerId||'new');syncLinkVisibility();
  };
  const linkCaption=document.querySelector('#taskFormModal .prayer-toggle-label');
  const linkTargetCaption=document.querySelector('#taskPrayerLinkOptions .flabel');
  if(linkCaption)linkCaption.textContent=local('기도제목에도 추가','Add to prayer requests');
  if(linkTargetCaption)linkTargetCaption.textContent=local('연결할 기도제목','Prayer request');
  refreshLinkOptions('new');syncLinkVisibility();

  // Replace only the task submit handler. Task and optional prayer link are saved atomically.
  taskForm.onsubmit=function(e){
    e.preventDefault();
    const repeat=$('taskRepeat').value,days=repeat==='weekly'?weekdayValues('taskWeekdays'):[],
      since=$('taskSince').value,until=repeat==='none'?'':$('taskUntil').value,
      due=repeat==='none'&&!$('taskDueNone').checked?$('taskDue').value:'';
    if(repeat==='weekly'&&!days.length){toast(KonaI18n.t('Choose at least one repeat day.'));return}
    if(until&&until<since){toast(KonaI18n.t('Check the end date.'));return}
    if(due&&due<since){toast(KonaI18n.t('Check the due date.'));return}
    if(repeat==='none'&&!$('taskDueNone').checked&&!due){toast(KonaI18n.t('A due date is required.'));return}
    const title=$('taskTitle').value.trim();if(!title)return;
    const prior=editTask?db.tasks.find(t=>t.id===editTask):null;
    const obj={...(prior||{}),id:editTask||uid(),title,kind:$('taskKind').value,
      repeat,days,since,until,due,important:$('taskImportant').checked};
    const linked=linkCheck.checked?linkTarget.value:'';
    if(linkCheck.checked&&linked!=='new'&&!db.prayers.some(p=>p.id===linked)){
      toast(local('연결할 기도제목을 다시 선택해 주세요.','Choose an existing prayer request.'));return;
    }
    const snapshot=JSON.stringify(db),isNew=!editTask;
    if(linkCheck.checked){
      if(linked==='new'){
        const prayer={id:uid(),title,note:'',since:nowLocal(),answered:null,
          lastPrayed:null,prevPrayed:null,count:0,responseLogs:[]};
        db.prayers.push(prayer);obj.linkedPrayerId=prayer.id;
      }else obj.linkedPrayerId=linked;
    }else obj.linkedPrayerId='';
    if(editTask)db.tasks=db.tasks.map(t=>t.id===editTask?obj:t);
    else db.tasks.push(obj);
    if(!save()&&!tutorialPractice){
      db=JSON.parse(snapshot);toast(local('저장되지 않았어요. 다시 시도해 주세요.','Task was not saved. Retry.'));return;
    }
    if(isNew){
      taskExpanded=true;lastAddedTaskId=obj.id;
      setTimeout(()=>{if(lastAddedTaskId===obj.id)lastAddedTaskId=''},2000);
    }
    clearTaskForm();closeSheet('taskFormModal');render();toast(KonaI18n.t('Saved'));
    if(isNew&&page==='today')requestAnimationFrame(()=>{
      const row=[...$('todayTaskList').querySelectorAll('[data-task-id]')].find(n=>n.dataset.taskId===obj.id);
      row?.scrollIntoView({block:'nearest',behavior:'smooth'});
    });
  };

  function rowsForFilter(){
    let list=db.prayers.filter(p=>{
      if(filter==='active'&&p.answered)return false;
      if(filter==='response'&&!hasResponse(p))return false;
      return !search||prayerTitle(p).toLocaleLowerCase().includes(search.toLocaleLowerCase());
    });
    list.sort((a,b)=>Number(Boolean(a.answered))-Number(Boolean(b.answered))
      ||(b.lastPrayed||b.since||'').localeCompare(a.lastPrayed||a.since||''));
    return list;
  }
  function makeRow(p){
    const row=node('div','prayer-item prayer-link-row');
    const main=action('', 'prayer-row-main',()=>{selectedId=p.id;addOpen=false;renderPrayerBox()});
    const heading=node('span','prayer-title',prayerTitle(p));heading.title=prayerTitle(p);
    let meta=p.answered?local('마무리됨','Closed'):
      (p.lastPrayed?local('마지막 기도 ','Last prayed ')+when(p.lastPrayed)+ ' · '+(p.count||0)+local('회',' times'):
      local('기도 기록 없음','No prayer records'));
    if(hasResponse(p))meta+=' · '+local('응답 기록','Response recorded');
    const text=node('span','prayer-copy');
    text.append(heading,node('span','meta-r',meta));
    main.append(text,node('span','prayer-chevron','›'));
    row.append(main);
    if(!p.answered){
      const today=nowLocal(),on=p.lastPrayed===today;
      row.append(action(on?'✓':'○','prayer-quick-mark'+(on?' is-done':''),()=>{
        if(write(()=>{if(on)unmarkPrayed(p,today);else markPrayed(p,today)})){
          render();renderPrayerBox();
        }
      }));
    }
    return row;
  }
  function addForm(){
    const form=node('form','prayer-add prayer-link-add');
    const input=node('input','field');
    input.maxLength=80;input.required=true;input.placeholder=local('새 기도제목','New prayer request');
    input.setAttribute('aria-label',local('새 기도제목','New prayer request'));
    const submit=node('button','mini-btn solid','＋');submit.type='submit';
    submit.setAttribute('aria-label',local('기도제목 추가','Add prayer request'));
    form.append(input,submit);
    form.addEventListener('submit',e=>{
      e.preventDefault();const title=input.value.trim();if(!title)return;
      if(write(()=>db.prayers.push({id:uid(),title,note:'',since:nowLocal(),answered:null,
          lastPrayed:null,prevPrayed:null,count:0,responseLogs:[]}),local('추가했어요','Added'))){
        addOpen=false;render();renderPrayerBox();
      }
    });
    return {form,input};
  }
  function heading(label){
    return node('div','prayer-list-caption',label);
  }
  function renderList(root){
    const ctl=node('div','prayer-library-controls');
    const input=node('input','field prayer-search');
    input.type='search';input.placeholder=local('기도제목 검색','Search prayer requests');
    input.setAttribute('aria-label',local('기도제목 검색','Search prayer requests'));
    input.value=search;
    const filters=node('div','prayer-filters');
    for(const [id,ko,en] of [['all','전체','All'],['active','기도 중','Praying'],['response','응답 기록','Responses']]){
      const b=action(local(ko,en),'prayer-filter'+(filter===id?' is-active':''),()=>{
        filter=id;renderPrayerBox();
      });
      b.setAttribute('aria-pressed',String(filter===id));filters.append(b);
    }
    ctl.append(input,filters);
    const list=node('div','prayer-link-list');
    input.addEventListener('input',()=>{
      search=input.value;fillRows(list);
    });
    root.append(ctl);
    if(addOpen){
      const f=addForm();root.append(f.form);requestAnimationFrame(()=>f.input.focus());
    }
    root.append(list);
    fillRows(list);
  }
  function fillRows(list){
    list.replaceChildren();const rows=rowsForFilter();
    if(!rows.length)list.append(node('p','prayer-empty',search?
      local('검색 결과가 없어요.','No matching requests.'):
      local('표시할 기도제목이 없어요.','No prayer requests here.')));
    else rows.forEach(p=>list.append(makeRow(p)));
  }
  function responseEntries(p){
    const list=storedResponses(p).filter(x=>x&&typeof x==='object').map(x=>({date:x.date||'',text:x.text||'',id:x.id}));
    // Legacy answer notes remain visible even after a prayer is reopened.
    if(p.answered||p.note){
      const originalDate=p.legacyResponseDate||p.answered||p.since||'';
      const isDuplicate=list.some(x=>x.date===originalDate&&x.text===(p.note||''));
      if(!isDuplicate)list.push({date:originalDate,text:p.note||'',legacy:true});
    }
    return list.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  }
  function detailButtons(p,root){
    const editor=node('div','prayer-inline-edit');editor.hidden=true;
    const titleInput=node('input','field');titleInput.maxLength=80;titleInput.value=prayerTitle(p);
    const editActions=node('div','prayer-detail-actions');
    editActions.append(action(local('취소','Cancel'),'mini-btn',()=>{editor.hidden=true}),
      action(saveLabel(),'mini-btn solid',()=>{
        const title=titleInput.value.trim();if(!title)return;
        if(write(()=>{p.title=title},local('저장했어요','Saved'))){selectedId=p.id;render();renderPrayerBox()}
      }));
    editor.append(titleInput,editActions);
    const actions=node('div','prayer-detail-actions');
    actions.append(action(local('제목 수정','Edit title'),'mini-btn',()=>{
      editor.hidden=false;titleInput.focus();
    }));
    actions.append(action(p.answered?local('다시 기도하기','Reopen'):local('기도 마무리','Close prayer'),'mini-btn',()=>{
      const wasClosed=Boolean(p.answered);
      if(write(()=>{if(wasClosed){p.legacyResponseDate??=p.answered;p.answered=null}else p.answered=nowLocal()},local('변경했어요','Updated'))){
        render();renderPrayerBox();
      }
    }));
    const del=node('div','prayer-inline-confirm');del.hidden=true;
    del.append(node('p','micro',local('이 기도제목을 삭제할까요? 연결된 할 일과 기도 기록은 유지돼요.',
      'Delete this request? Linked tasks and prayer sessions remain.')));
    const delBtns=node('div','prayer-detail-actions');
    delBtns.append(action(local('취소','Cancel'),'mini-btn',()=>{del.hidden=true}),
      action(local('삭제','Delete'),'mini-btn prayer-danger',()=>{
        const id=p.id;
        if(write(()=>{
          db.prayers=db.prayers.filter(item=>item.id!==id);
          // Keep task records, but prevent dangling prayer references.
          for(const t of db.tasks)if(t.linkedPrayerId===id)t.linkedPrayerId='';
        },local('삭제했어요','Deleted'))){
          selectedId='';render();renderPrayerBox();
        }
      }));
    del.append(delBtns);
    actions.append(action(local('삭제','Delete'),'mini-btn prayer-delete-link',()=>{del.hidden=!del.hidden}));
    root.append(actions,editor,del);
  }
  function renderDetail(root,p){
    const back=action('‹ '+local('기도제목','Prayer requests'),'prayer-back',()=>{
      selectedId='';renderPrayerBox();
    });
    const title=node('h3','prayer-detail-title',prayerTitle(p));
    const meta=node('p','prayer-detail-meta',
      local('시작 ','Started ')+when(p.since)+ ' · '+
      (p.answered?local('마무리됨','Closed'):local('기도 중','Praying')));
    root.append(back,title,meta);
    const summary=node('div','prayer-detail-summary',
      (p.lastPrayed?local('마지막 기도 ','Last prayed ')+when(p.lastPrayed)+' · ':'')+
      (p.count||0)+local('회 기도',' prayers'));
    root.append(summary);
    const ltasks=linkedTasks(p);
    if(ltasks.length){
      root.append(heading(local('연결된 할 일','Linked tasks')));
      for(const task of ltasks){
        const taskRow=node('div','prayer-linked-task');
        taskRow.append(node('span','',task.title),
          node('span','meta-r',task.repeat==='daily'?local('매일','Daily'):
            task.repeat==='weekly'?local('매주','Weekly'):local('한 번','One time')));
        root.append(taskRow);
      }
    }
    const history=Object.entries(db.days).flatMap(([d,v])=>
      (v.sessions||[]).filter(s=>s.kind==='prayer'&&s.prayerId===p.id).map(s=>({
        date:d,text:s.note||'',id:s.id
      }))).sort((a,b)=>b.date.localeCompare(a.date));
    root.append(heading(local('기도와 응답 기록','Prayer and response history')));
    const add=action('＋ '+local('응답·감사 기록','Add response / gratitude'),'prayer-add-response',()=>{
      responseForm.hidden=!responseForm.hidden;
      if(!responseForm.hidden)responseText.focus();
    });
    root.append(add);
    const responseForm=node('form','prayer-response-form');responseForm.hidden=true;
    const responseText=node('textarea','field');responseText.maxLength=3000;responseText.rows=3;
    responseText.placeholder=local('응답이나 감사한 내용을 남겨 주세요.','Record a response or gratitude.');
    responseText.required=true;
    const responseSubmit=node('button','mini-btn solid',saveLabel());responseSubmit.type='submit';
    responseForm.append(responseText,responseSubmit);
    responseForm.addEventListener('submit',e=>{
      e.preventDefault();const text=responseText.value.trim();if(!text)return;
      if(write(()=>{p.responseLogs??=[];p.responseLogs.push({
          id:uid(),date:nowLocal(),text
        })},local('기록했어요','Recorded'))){
        render();renderPrayerBox();
      }
    });
    root.append(responseForm);
    const entries=[...responseEntries(p).map(x=>({...x,type:'response'})),
      ...history.map(x=>({...x,type:'prayer'}))]
      .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    if(!entries.length)root.append(node('p','prayer-empty',local('아직 기록이 없어요.','No records yet.')));
    else entries.forEach(x=>{
      const entry=node('div','prayer-record-row');
      entry.append(node('span','prayer-record-date',when(x.date)+' · '+
        (x.type==='response'?local('응답·감사','Response / gratitude'):local('기도','Prayer'))));
      if(x.text)entry.append(node('p','prayer-record-text',x.text));
      root.append(entry);
    });
    detailButtons(p,root);
  }
  renderPrayerBox=function(){
    const card=modal.querySelector('.prayer-card'),root=card.querySelector('.prayer-box');
    if(card.hidden)return;
    const act=activePrayers().length;
    $('prayerCount').textContent='('+act+')';
    $('focusLibraryTitle').textContent=local('기도제목','Prayer requests')+' ('+db.prayers.length+')';
    root.replaceChildren();
    const p=db.prayers.find(x=>x.id===selectedId);
    const add=$('togglePrayerAdd');
    add.hidden=Boolean(p);
    if(p)renderDetail(root,p);
    else renderList(root);
    add.onclick=()=>{
      addOpen=!addOpen;renderPrayerBox();
    };
    add.setAttribute('aria-expanded',String(addOpen&&!p));
    const globalHistory=modal.querySelector('.focus-history');
    if(globalHistory)globalHistory.hidden=true; // Detail owns prayer history.
  };
  const oldOpenFocusLibrary=openFocusLibrary;
  openFocusLibrary=function(){
    selectedId='';addOpen=false;filter='all';search='';
    oldOpenFocusLibrary.apply(this,arguments);
    const kind=sess.started?sess.kind:sessKind;
    const globalHistory=modal.querySelector('.focus-history');
    if(globalHistory)globalHistory.hidden=kind==='prayer';
    if(kind==='prayer')renderPrayerBox();
  };
})();
