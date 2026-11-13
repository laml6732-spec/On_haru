/* On_HARU Scripture Memory v1 — isolated feature, no existing journal schema changes. */
(function(){
  'use strict';
  const VERSION=1, KEY='kona.scripture-memory.v1';
  const DATA_URL='./data/scripture-memory-100.json';
  const NKRV_DATA_URL='./data/scripture-memory-100.ko-nkrv.json';
  const API_BASE='https://api.nlt.to/api/passages';
  const RELAY_PATH='./nlt';
  const DAY_INTERVALS=[1,3,7,14,30];
  const q=(s,root=document)=>root.querySelector(s);
  const button=(label,klass)=>{const b=document.createElement('button');b.type='button';b.className=klass||'';b.textContent=label;return b;};
  const el=(tag,klass,text)=>{const node=document.createElement(tag);if(klass)node.className=klass;if(text!==undefined)node.textContent=text;return node;};
  const tr=(ko,en)=>language()==='ko'?ko:en;
  const language=()=>{try{return (typeof KonaI18n!=='undefined'&&KonaI18n.language==='ko')||document.documentElement.lang==='ko'?'ko':'en';}catch{return 'en';}};
  const today=()=>{try{if(typeof nowLocal==='function')return nowLocal();}catch{}const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
  const addDays=(ymd,n)=>{const parts=ymd.split('-').map(Number);const day=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]+n));return day.toISOString().slice(0,10);};
  const empty=()=>({schema_version:VERSION,active_passage_id:null,passages:{}});
  const ensureStatus=x=>['not_started','learning','memorized'].includes(x)?x:'not_started';
  function safeState(source){
    if(!source||source.schema_version!==VERSION||!source.passages||typeof source.passages!=='object'||Array.isArray(source.passages))return empty();
    const result=empty();result.active_passage_id=typeof source.active_passage_id==='string'?source.active_passage_id:null;
    for(const [id,record] of Object.entries(source.passages)){
      if(!/^[a-z0-9-]{3,96}$/.test(id)||!record||typeof record!=='object')continue;
      const attempts=Array.isArray(record.attempts)?record.attempts.filter(a=>a&&typeof a.at==='string'&&['recalled','partial','forgot'].includes(a.result)).slice(-200):[];
      result.passages[id]={
        status:ensureStatus(record.status),memorized_at:typeof record.memorized_at==='string'?record.memorized_at:null,
        last_practiced_at:typeof record.last_practiced_at==='string'?record.last_practiced_at:null,
        last_practiced_on:/^\d{4}-\d{2}-\d{2}$/.test(record.last_practiced_on||'')?record.last_practiced_on:null,
        next_review_on:/^\d{4}-\d{2}-\d{2}$/.test(record.next_review_on||'')?record.next_review_on:null,
        review_stage:Number.isInteger(record.review_stage)?Math.min(4,Math.max(0,record.review_stage)):0,
        attempts
      };
    }
    return result;
  }
  let state;let storageWarning=false;
  try{const raw=localStorage.getItem(KEY);state=raw?safeState(JSON.parse(raw)):empty();}catch{state=empty();storageWarning=true;}
  let catalog=[],koreanVerses=new Map(),translation='NLT',active=null,screen='practice',origin='write',mode='read',checkOpen=false,loading=false,passageText='',providerError='';
  let lastFocused=null,previousBodyOverflow='',requestNumber=0,ignoreNextPop=false;
  let filter='all',searchText='',pendingImport=null;
  function recordFor(id){return state.passages[id]||{status:'not_started',memorized_at:null,last_practiced_at:null,last_practiced_on:null,next_review_on:null,review_stage:0,attempts:[]};}
  function persist(next){
    try{localStorage.setItem(KEY,JSON.stringify(next));state=next;storageWarning=false;return true;}
    catch{storageWarning=true;return false;}
  }
  function byId(id){return catalog.find(v=>v.id===id);}
  function nextEntry(){
    const d=today();
    const due=catalog.filter(v=>{const r=recordFor(v.id);return r.status!=='not_started'&&r.next_review_on&&r.next_review_on<=d;})
      .sort((a,b)=>recordFor(a.id).next_review_on.localeCompare(recordFor(b.id).next_review_on));
    if(due.length)return {item:due[0],due:due.length};
    const current=byId(state.active_passage_id);
    if(current&&recordFor(current.id).status!=='memorized')return {item:current,due:0};
    const unstarted=catalog.find(v=>recordFor(v.id).status==='not_started');
    return {item:unstarted||current||catalog[0]||null,due:0};
  }
  const uid='sm-overlay';
  const overlay=el('div','sm-overlay');overlay.id=uid;overlay.hidden=true;
  overlay.innerHTML=[
    '<section class="sm-surface" role="dialog" aria-modal="true" aria-labelledby="sm-heading" tabindex="-1">',
      '<header class="sm-header"><button type="button" class="sm-back" aria-label="Back">‹</button><div class="sm-header-title"><span class="sm-eyebrow" id="sm-eyebrow"></span><h2 id="sm-heading"></h2></div><span id="sm-counter" class="sm-counter"></span></header>',
      '<div id="sm-content" class="sm-content"></div>',
    '</section>'
  ].join('');
  document.body.append(overlay);
  const content=q('#sm-content',overlay),heading=q('#sm-heading',overlay),eyebrow=q('#sm-eyebrow',overlay),counter=q('#sm-counter',overlay);
  const home=q('#page-capture'),composer=q('#page-capture #qc-v2');
  let cue=null;
  if(home&&composer){
    cue=button('','sm-cue');cue.id='sm-write-cue';
    cue.innerHTML='<span class="sm-cue-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5c-3.2-1.7-6.3-1.9-9-1v14c2.7-.9 5.8-.7 9 1 3.2-1.7 6.3-1.9 9-1v-14c-2.7-.9-5.8-.7-9 1z"/><path d="M12 5.5v14"/></svg></span><span class="sm-cue-copy"><strong class="sm-cue-label"></strong><small class="sm-cue-detail"></small></span><span class="sm-cue-arrow" aria-hidden="true">›</span>';
    composer.insertAdjacentElement('afterend',cue);
    cue.addEventListener('click',()=>{const item=nextEntry().item;if(item)openPractice(item,'write');else openLibrary('write');});
  }
  const focusRoot=q('#page-focus'),focusExtras=q('#focusSetupMore');
  let focusEntry=null;
  if(focusRoot&&focusExtras){
    focusEntry=button('','sm-focus-entry');
    focusEntry.id='sm-focus-entry';
    focusEntry.innerHTML='<span aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5c-3.2-1.7-6.3-1.9-9-1v14c2.7-.9 5.8-.7 9 1 3.2-1.7 6.3-1.9 9-1v-14c-2.7-.9-5.8-.7-9 1z"/><path d="M12 5.5v14"/></svg></span><span class="sm-focus-copy"></span><span aria-hidden="true">›</span>';
    focusExtras.prepend(focusEntry);
    focusEntry.addEventListener('click',()=>{const item=nextEntry().item;if(item)openPractice(item,'focus');else openLibrary('focus');});
  }
  const reviewSwitch=q('#page-records #new-review-switch'),archiveButton=q('#rev-archive');
  let libraryEntry=null;
  if(reviewSwitch&&archiveButton){
    libraryEntry=button('','sm-library-entry');
    libraryEntry.id='sm-library-entry';
    libraryEntry.innerHTML='<span class="sm-library-label"></span><span class="sm-library-count"></span><span class="sm-cue-arrow" aria-hidden="true">›</span>';
    reviewSwitch.insertAdjacentElement('afterend',libraryEntry);
    libraryEntry.addEventListener('click',()=>openLibrary('review'));
  }
  function updateEntries(){
    if(cue){
      let chosen=nextEntry(),item=chosen.item;
      let dateIsToday=true;
      try{if(typeof date==='string'&&typeof nowLocal==='function')dateIsToday=date===nowLocal();}catch{}
      cue.hidden=!dateIsToday||!item;
      if(item){
        const st=recordFor(item.id),practiced=st.last_practiced_on===today();
        const label=practiced?tr('오늘 연습했어요','Practiced today'):chosen.due?tr('오늘 복습할 말씀','Scripture to review'):st.status==='not_started'?tr('말씀 시작하기','Start scripture memory'):st.status==='memorized'?tr('말씀 다시 읽기','Revisit scripture'):tr('말씀 이어하기','Continue scripture');
        q('.sm-cue-label',cue).textContent=label;
        q('.sm-cue-detail',cue).textContent=item.reference+(chosen.due>1?' · '+tr('외 '+(chosen.due-1)+'개 복습', (chosen.due-1)+' more due'):'');
        cue.setAttribute('aria-label',label+' · '+item.reference);
      }
    }
    if(focusEntry){
      q('.sm-focus-copy',focusEntry).textContent=tr('말씀 암송 · 100개 서재','Scripture memory · 100 passages');
      focusEntry.hidden=q('#kindSeg [data-kind="devotion"]')?.getAttribute('aria-pressed')!=='true';
    }
    if(libraryEntry){
      q('.sm-library-label',libraryEntry).textContent=tr('말씀 서재','Scripture Library');
      const n=catalog.filter(v=>recordFor(v.id).status==='memorized').length;
      q('.sm-library-count',libraryEntry).textContent=n+'/100';
      libraryEntry.hidden=archiveButton.getAttribute('aria-pressed')!=='true';
    }
  }
  const observer=new MutationObserver(()=>updateEntries());
  if(archiveButton)observer.observe(archiveButton,{attributes:true,attributeFilter:['aria-pressed']});
  if(q('#kindSeg'))observer.observe(q('#kindSeg'),{subtree:true,attributes:true,attributeFilter:['aria-pressed']});
  const dateNode=q('#dateLabel');
  if(dateNode)observer.observe(dateNode,{characterData:true,childList:true,subtree:true});
  document.addEventListener('click',e=>{
    if(e.target.closest('.tabs, #prevDay, #nextDay, #todayChip, #datePicker, #rev-archive, #rev-reflect, #kindSeg, #konaLanguage'))setTimeout(updateEntries,0);
  });
  document.addEventListener('change',e=>{if(e.target.closest('#datePicker, #konaLanguage'))setTimeout(updateEntries,0);});
  window.addEventListener('focus',updateEntries);
  window.addEventListener('storage',e=>{
    if(e.key===KEY){try{state=e.newValue?safeState(JSON.parse(e.newValue)):empty();}catch{storageWarning=true;}updateEntries();if(!overlay.hidden)render();}
  });
  q('.sm-back',overlay).addEventListener('click',back);
  function open(){
    lastFocused=document.activeElement;previousBodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    overlay.hidden=false;overlay.classList.add('sm-visible');
    try{history.pushState({...history.state,smOverlay:true},'',location.href);}catch{}
    q('.sm-back',overlay).focus();
  }
  function close(fromPopstate=false){
    overlay.hidden=true;overlay.classList.remove('sm-visible');document.body.style.overflow=previousBodyOverflow;
    if(lastFocused&&lastFocused.isConnected&&typeof lastFocused.focus==='function')lastFocused.focus();
    updateEntries();
    if(!fromPopstate&&history.state?.smOverlay){
      ignoreNextPop=true;history.back();
    }
  }
  window.addEventListener('popstate',e=>{
    if(ignoreNextPop){ignoreNextPop=false;e.stopImmediatePropagation();return;}
    if(!overlay.hidden){e.stopImmediatePropagation();close(true);}
  },true);
  function back(){if(screen==='practice'&&origin==='library'){screen='library';mode='read';render();return;}if(screen==='import'){screen='library';pendingImport=null;render();return;}close();}
  overlay.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();back();return;}
    if(e.key==='Tab'){const focusable=[...overlay.querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled]):not([hidden]),a[href]')].filter(n=>n.getClientRects().length);if(!focusable.length)return;let first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  // History Back closes the local overlay without mutating main application history.
  document.addEventListener('click',e=>{if(e.target===overlay)back();});
  function openPractice(item,from){
    if(!item)return;
    origin=from;active=item;screen='practice';mode='read';checkOpen=false;passageText='';providerError='';loading=false;
    translation=language()==='ko'&&koreanVerses.has(item.id)?'NKRV':'NLT';
    if(from==='write'&&typeof nav==='function')try{nav('focus',{kind:'devotion'});}catch{}
    if(recordFor(item.id).status==='not_started'){
      const next=safeState(state);next.active_passage_id=item.id;
      next.passages[item.id]={...recordFor(item.id),status:'learning'};
      persist(next);
    }else if(state.active_passage_id!==item.id){
      const next=safeState(state);next.active_passage_id=item.id;persist(next);
    }
    if(overlay.hidden)open();render();if(translation==='NLT')loadText(item);
  }
  function openLibrary(from){
    origin=from;screen='library';active=null;checkOpen=false;filter='all';searchText='';
    if(overlay.hidden)open();render();
  }
  const bibleUrl=item=>{const p=new URLSearchParams({ref:item.reference,version:'NLT',key:'TEST'});return API_BASE+'?'+p.toString();};
  async function loadText(item){
    const serial=++requestNumber;loading=true;providerError='';passageText='';render();
    try{
      // Same-origin Cloudflare Pages Function relays NLT text. No text is cached or committed.
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),9000);
      let res;
      try{res=await fetch(RELAY_PATH+'?'+new URLSearchParams({ref:item.reference}),{method:'GET',credentials:'same-origin',signal:controller.signal,cache:'no-store'});}
      finally{clearTimeout(timeout);}
      if(!res.ok)throw new Error('HTTP '+res.status);
      const html=await res.text();const doc=new DOMParser().parseFromString(html,'text/html');
      doc.querySelectorAll('script,style,iframe,form').forEach(n=>n.remove());
      const paragraphs=[...doc.querySelectorAll('p')].map(n=>n.textContent?.replace(/\s+/g,' ').trim().replace(/^(\d{1,3})(?=[A-Za-z])/, '$1 ')).filter(Boolean);
      const text=(paragraphs.length?paragraphs.join('\n\n'):doc.body.textContent||'').trim();
      if(text.length<10)throw new Error('No passage content');
      if(serial!==requestNumber)return;passageText=text;
    }catch(error){
      if(serial!==requestNumber)return;
      providerError=String(error&&error.message||error);passageText='';
    }finally{if(serial===requestNumber){loading=false;render();}}
  }
  function resetContent(){content.replaceChildren();heading.textContent=screen==='library'?tr('말씀 서재','Scripture Library'):screen==='import'?tr('학습 기록 복원','Restore progress'):tr('말씀 암송','Scripture memory');eyebrow.textContent=screen==='practice'?'FOCUS · DEVOTION':'ON_HARU · SCRIPTURE';counter.textContent=screen==='practice'&&active?active.order+'/100':catalog.length+' '+tr('구절','passages');}
  function render(){resetContent();if(screen==='library')renderLibrary();else if(screen==='import')renderImport();else renderPractice();}
  function statusLabel(s){return s==='memorized'?tr('암송 완료','Memorized'):s==='learning'?tr('학습 중','Learning'):tr('미시작','Not started');}
  function renderPractice(){
    if(!active)return;
    const r=recordFor(active.id);
    const ref=el('div','sm-reference',active.reference+' · '+(translation==='NKRV'?'개역개정':'NLT'));content.append(ref);
    if(koreanVerses.has(active.id)){
      const versions=el('div','sm-segments sm-versions');versions.setAttribute('role','group');versions.setAttribute('aria-label',tr('성경 번역본','Bible translation'));
      for(const [v,label] of [['NLT','English · NLT'],['NKRV','한국어 · 개역개정']]){
        const b=button(label,'sm-segment'+(translation===v?' is-selected':''));b.setAttribute('aria-pressed',String(translation===v));
        b.onclick=()=>{if(translation===v)return;translation=v;checkOpen=false;requestNumber++;loading=false;providerError='';
          if(v==='NLT'&&!passageText){loadText(active);}else render();};
        versions.append(b);
      }content.append(versions);
    }
    const tabs=el('div','sm-segments');tabs.setAttribute('role','group');tabs.setAttribute('aria-label',tr('암송 방식','Practice mode'));
    for(const [key,label] of [['read',tr('읽기','Read')],['recall',tr('가리고 암송','Recall')]]){
      const b=button(label,'sm-segment'+(key===mode?' is-selected':''));b.setAttribute('aria-pressed',String(mode===key));
      b.addEventListener('click',()=>{mode=key;checkOpen=false;render();});tabs.append(b);
    }content.append(tabs);
    if(mode==='read'){
      const paper=el('div','sm-paper');
      if(translation==='NKRV'&&koreanVerses.has(active.id)){
        for(const v of koreanVerses.get(active.id)){
          const p=el('p','sm-verse');p.lang='ko';
          p.append(el('sup','sm-verse-number',String(v.number)),document.createTextNode(' '+v.text));paper.append(p);
        }
      }
      else if(loading)paper.append(el('p','sm-status',tr('NLT 본문을 불러오는 중…','Loading NLT passage…')));
      else if(passageText){
        for(const paragraph of passageText.split(/\n\n+/)){const p=el('p','sm-verse');const num=/^(\d{1,3})\s+(.+)$/.exec(paragraph);if(num)p.append(el('sup','sm-verse-number',num[1]),document.createTextNode(' '+num[2]));else p.textContent=paragraph;paper.append(p);}
      }else{
        paper.append(el('p','sm-status',tr('NLT 본문을 이 기기에서 불러오지 못했어요.','Could not load NLT text on this device.')));
        paper.append(el('p','sm-meta',tr('인터넷 연결·API 접근 권한을 확인하거나 공식 본문을 열어 읽을 수 있어요.','Check your connection or API access, or open the official passage.')));
        if(providerError){const retry=button(tr('다시 시도','Retry'),'sm-link-btn');retry.onclick=()=>loadText(active);paper.append(retry);}
      }
      content.append(paper);
    }else{
      const recall=el('div','sm-recall');
      recall.append(el('div','sm-recall-mark','◌'));
      recall.append(el('h3','',tr('본문을 보지 않고 기억해 보세요','Recall the passage without looking')));
      recall.append(el('p','sm-meta',tr('기억나는 만큼 소리 내어 말한 뒤 확인하세요.','Say what you remember, then check the passage.')));
      const reveal=button(tr('본문 다시 확인','Show passage'),'sm-link-btn');reveal.onclick=()=>{mode='read';checkOpen=false;render();};recall.append(reveal);content.append(recall);
    }
    const primary=button(tr('암송 점검하기','Check recall'),'sm-primary');primary.addEventListener('click',()=>{checkOpen=!checkOpen;render();});content.append(primary);
    if(checkOpen){
      const panel=el('section','sm-check');
      panel.append(el('h3','',tr('얼마나 기억했나요?','How much did you recall?')));
      for(const [value,ko,en] of [['recalled','기억했어요','I remembered'],['partial','일부만 기억했어요','Partly remembered'],['forgot','기억나지 않아요','Not yet']]){
        const b=button(tr(ko,en),'sm-check-choice');b.onclick=()=>saveAttempt(value);panel.append(b);
      }
      content.append(panel);
    }
    const tools=el('div','sm-foot-actions');
    const complete=button(r.status==='memorized'?tr('암송 완료됨 · 다시 학습','Memorized · Practice again'):tr('암송 완료로 표시','Mark as memorized'),'sm-link-btn');
    complete.onclick=()=>{if(r.status==='memorized'){mode='recall';checkOpen=false;render();return;}markMemorized();};
    const lib=button(tr('100개 말씀 보기','Browse 100 passages'),'sm-link-btn');lib.onclick=()=>{origin='library';screen='library';render();};
    tools.append(complete,lib);content.append(tools);
    if(translation==='NKRV'){
      content.append(el('p','sm-attribution','개역개정 © 대한성서공회 · 저장된 한국어 본문'));
    }else{
      const links=el('div','sm-source-links');
      const source=el('a','sm-source',tr('NLT 본문 외부에서 읽기','Open NLT passage'));source.href=bibleUrl(active);source.rel='noopener noreferrer';source.target='_blank';
      const context=el('a','sm-source',tr('앞뒤 문맥 보기','Read in context'));context.href=API_BASE+'?'+new URLSearchParams({ref:active.book+' '+active.chapter,version:'NLT',key:'TEST'});context.rel='noopener noreferrer';context.target='_blank';
      links.append(source,context);content.append(links);
      content.append(el('p','sm-attribution','Scripture quotations: New Living Translation (NLT), Tyndale House Publishers. Source: api.nlt.to.'));
    }
    if(storageWarning)content.append(el('p','sm-error',tr('학습 기록이 이 기기에 저장되지 않았어요. 저장 공간을 확인해 주세요.','Progress could not be saved on this device. Check storage permissions.')));
  }
  function saveAttempt(result){
    if(!active)return;
    const current=safeState(state),d=today(),old=recordFor(active.id),stage=result==='recalled'?Math.min(4,old.review_stage+1):0;
    const next={
      ...old,status:old.status==='memorized'?'memorized':'learning',last_practiced_at:new Date().toISOString(),
      last_practiced_on:d,review_stage:stage,next_review_on:addDays(d,result==='recalled'?DAY_INTERVALS[stage]:1),
      attempts:[...(old.attempts||[]),{at:new Date().toISOString(),result}].slice(-200)
    };
    current.passages[active.id]=next;current.active_passage_id=active.id;
    const ok=persist(current);checkOpen=false;
    render();if(ok)notice(tr('오늘 연습을 기록했어요','Practice saved'));updateEntries();
  }
  function markMemorized(){
    const next=safeState(state);const r=recordFor(active.id);
    next.passages[active.id]={...r,status:'memorized',memorized_at:r.memorized_at||new Date().toISOString(),next_review_on:r.next_review_on||addDays(today(),1)};
    next.active_passage_id=active.id;
    const ok=persist(next);render();if(ok)notice(tr('암송 완료로 표시했어요','Marked as memorized'));updateEntries();
  }
  function notice(text){
    let n=q('#sm-feedback',overlay);if(!n){n=el('div','sm-feedback');n.id='sm-feedback';n.setAttribute('role','status');overlay.append(n);}
    n.textContent=text;n.hidden=false;clearTimeout(notice.handle);notice.handle=setTimeout(()=>{n.hidden=true;},2800);
  }
  function renderLibrary(){
    const completed=catalog.filter(x=>recordFor(x.id).status==='memorized').length;
    const due=catalog.filter(x=>{const r=recordFor(x.id);return r.next_review_on&&r.next_review_on<=today();}).length;
    const summary=el('div','sm-summary');
    summary.append(el('span','sm-summary-main',tr('암송 완료 ','Memorized ')+completed+' / '+catalog.length));
    summary.append(el('span','sm-meta',tr('복습할 말씀 ','Due for review ')+due));content.append(summary);
    const row=el('div','sm-lib-controls');
    const input=el('input','sm-search');input.type='search';input.value=searchText;input.placeholder=tr('성경 이름 또는 장절 검색','Search book or reference');
    input.setAttribute('aria-label',input.placeholder);
    input.addEventListener('input',()=>{searchText=input.value;updateLibraryList();});
    row.append(input);content.append(row);
    const seg=el('div','sm-segments');
    for(const [key,ko,en] of [['all','전체','All'],['learning','학습 중','Learning'],['memorized','완료','Memorized']]){
      const b=button(tr(ko,en),'sm-segment'+(filter===key?' is-selected':''));b.setAttribute('aria-pressed',String(filter===key));b.onclick=()=>{filter=key;render();};seg.append(b);
    }content.append(seg);
    const list=el('div','sm-list');list.id='sm-list';content.append(list);
    updateLibraryList();
    const actions=el('div','sm-backup-actions');
    const exportBtn=button(tr('학습 기록 내보내기','Export progress'),'sm-link-btn');exportBtn.onclick=exportProgress;
    const importBtn=button(tr('학습 기록 복원','Restore progress'),'sm-link-btn');
    const file=el('input');file.type='file';file.accept='application/json,.json';file.hidden=true;
    file.onchange=async()=>{const chosen=file.files?.[0];if(!chosen)return;try{const raw=JSON.parse(await chosen.text());if(raw.format!=='onharu-scripture-progress'||raw.data?.schema_version!==VERSION)throw new Error('Invalid backup');pendingImport=safeState(raw.data);screen='import';render();}catch{notice(tr('지원하지 않는 학습 기록 파일입니다','Invalid progress backup'));}file.value='';};
    importBtn.onclick=()=>file.click();actions.append(exportBtn,importBtn,file);content.append(actions);
    content.append(el('p','sm-meta',tr('학습 기록은 이 기기에 저장됩니다. 기존 메모 백업과 별도로 내보낼 수 있어요.','Progress is saved on this device. Export it separately from your journal backup.')));
    if(storageWarning)content.append(el('p','sm-error',tr('저장소에 접근하지 못했어요. 진행 기록이 보존되지 않을 수 있어요.','Local storage unavailable. Your progress may not persist.')));
  }
  function updateLibraryList(){
    const target=q('#sm-list',content);if(!target)return;target.replaceChildren();
    const needle=searchText.trim().toLowerCase();
    const items=catalog.filter(x=>(filter==='all'||recordFor(x.id).status===filter)&&(!needle||x.reference.toLowerCase().includes(needle)||x.book.toLowerCase().includes(needle)||String(x.chapter).includes(needle)));
    if(!items.length){target.append(el('p','sm-empty',tr('일치하는 말씀이 없어요. 검색어나 필터를 바꿔보세요.','No matching passages. Change your search or filter.')));return;}
    for(const item of items){
      const row=button('','sm-list-row');
      const order=el('span','sm-list-number',String(item.order).padStart(2,'0'));
      const desc=el('span','sm-list-desc');desc.append(el('strong','',item.reference));desc.append(el('small','',statusLabel(recordFor(item.id).status)));
      const arrow=el('span','sm-list-arrow','›');arrow.setAttribute('aria-hidden','true');row.append(order,desc,arrow);
      row.onclick=()=>openPractice(item,'library');target.append(row);
    }
  }
  function exportProgress(){
    const payload=JSON.stringify({format:'onharu-scripture-progress',exported_at:new Date().toISOString(),data:safeState(state)},null,2);
    const url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='onharu-scripture-progress-'+today()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    notice(tr('학습 기록 파일을 만들었어요','Progress export created'));
  }
  function renderImport(){
    content.append(el('p','sm-reference',tr('이 기기의 기존 암송 학습 기록을 교체합니다. 메모나 일정에는 영향을 주지 않아요.','This replaces scripture progress on this device. Notes and schedules are not affected.')));
    const buttons=el('div','sm-confirm-actions');
    const cancel=button(tr('취소','Cancel'),'sm-link-btn');cancel.onclick=()=>{pendingImport=null;screen='library';render();};
    const confirm=button(tr('학습 기록 복원','Restore progress'),'sm-primary');
    confirm.onclick=()=>{if(!pendingImport)return;const validIds=new Set(catalog.map(e=>e.id));const next=safeState(pendingImport);
      for(const id of Object.keys(next.passages))if(!validIds.has(id))delete next.passages[id];
      if(next.active_passage_id&&!validIds.has(next.active_passage_id))next.active_passage_id=null;
      if(persist(next)){screen='library';pendingImport=null;render();notice(tr('학습 기록을 복원했어요','Progress restored'));updateEntries();}
      else notice(tr('복원 내용을 저장하지 못했어요','Unable to save restored progress'));
    };
    buttons.append(cancel,confirm);content.append(buttons);
  }
  async function init(){
    try{const response=await fetch(DATA_URL,{cache:'default'});if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json();if(!Array.isArray(data.entries)||data.entries.length!==100)throw new Error('Catalog size mismatch');
      const seen=new Set();for(const x of data.entries){if(!x.id||seen.has(x.id)||!Number.isInteger(x.order)||x.order!==seen.size+1)throw new Error('Invalid order/ID');seen.add(x.id);}
      catalog=data.entries;
    }catch(err){
      console.warn('Scripture catalog unavailable',err);
      if(cue){cue.hidden=true;}if(focusEntry){focusEntry.hidden=true;}if(libraryEntry){libraryEntry.hidden=true;}
      return;
    }
    // Korean text is an optional, separately licensed static asset. Never invent it.
    // Reject all partial, duplicate, out-of-range, or mismatched collections.
    try{
      const response=await fetch(NKRV_DATA_URL,{cache:'default'});
      if(response.ok){
        const data=await response.json();
        if(data?.schema_version!==1||data.translation!=='NKRV'||!Array.isArray(data.entries)||data.entries.length!==catalog.length)throw new Error('NKRV catalog mismatch');
        const expected=new Map(catalog.map(item=>[item.id,item]));
        const loaded=new Map();
        for(const entry of data.entries){
          const ref=expected.get(entry.id);
          if(!ref||loaded.has(entry.id)||entry.reference!==ref.reference||!Array.isArray(entry.verses)||entry.verses.length!==ref.verse_end-ref.verse_start+1)throw new Error('NKRV reference mismatch');
          for(let i=0;i<entry.verses.length;i++){
            const v=entry.verses[i];
            if(v?.number!==ref.verse_start+i||typeof v.text!=='string'||!v.text.trim())throw new Error('NKRV verse mismatch');
          }
          loaded.set(entry.id,entry.verses);
        }
        koreanVerses=loaded;
      }
    }catch(error){console.warn('NKRV data unavailable; using NLT',error);}
    updateEntries();
  }
  init();
})();
