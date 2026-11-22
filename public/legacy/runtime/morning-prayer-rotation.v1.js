/* On_HARU Morning Check-in prayer copy. Visual UI only; does not touch journal records. */
(() => {
 'use strict';
 const COPY = Object.freeze([{"id":1,"lines":["하나님이 선물하신 오늘,","이 하루를 주님께 올려드립니다.","어떻게 살아가야 할지 말씀해 주세요."]},{"id":2,"lines":["주님, 분주한 마음을 잠잠하게 하시고","기대하는 마음으로 주님의 음성에","귀 기울이게 해주세요."]},{"id":3,"lines":["주님, 오늘 제가 걸어갈 길을","주님께 맡겨드립니다.","한 걸음씩 인도해 주세요."]},{"id":4,"lines":["주님, 제 생각보다 주님의 뜻을","먼저 구합니다. 오늘 무엇을","원하시는지 알려주세요."]},{"id":5,"lines":["주님, 오늘의 모든 순간에","주님과 함께 걷고 싶습니다.","주님의 임재를 기억하게 해주세요."]},{"id":6,"lines":["주님, 제 마음을 열어드립니다.","말씀하실 때 듣게 하시고,","깨닫게 하신 것에 순종하게 해주세요."]},{"id":7,"lines":["주님이 예비하신 오늘을 기대합니다.","평범한 일상 속에서도","주님이 일하심을 발견하게 해주세요."]},{"id":8,"lines":["주님, 오늘 만나는 사람들에게","주님의 사랑을 흘려보내기 원합니다.","제 마음과 발걸음을 이끌어 주세요."]}]);
 const KEY = 'onharu.morningPrayerDailyDeck.v1';
 const validIndex = n => Number.isInteger(n) && n >= 0 && n < COPY.length;
 const validDeck = a => Array.isArray(a) && a.length <= COPY.length && a.every(validIndex) && new Set(a).size === a.length;
 function shuffledDeck(previous) {
   const deck=COPY.map((_,i)=>i);
   for(let i=deck.length-1;i>0;i--){
     let j;
     if(window.crypto && window.crypto.getRandomValues){
       const random=new Uint32Array(1);window.crypto.getRandomValues(random);
       j=random[0]%(i+1);
     } else j=Math.floor(Math.random()*(i+1));
     [deck[i],deck[j]]=[deck[j],deck[i]];
   }
   // Avoid repeating yesterday's prayer when a new eight-day deck begins.
   if(validIndex(previous) && deck[0]===previous)[deck[0],deck[1]]=[deck[1],deck[0]];
   return deck;
 }
 function pick(day){
   // The app's timezone-aware nowLocal() value is passed by its controller.
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day)) return COPY[0];
   let state=null;
   try{state=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){}
   if(state && state.day===day && validIndex(state.choice))return COPY[state.choice];
   const previous=state && validIndex(state.choice)?state.choice:null;
   let remaining=state && validDeck(state.remaining)?state.remaining.slice():[];
   if(!remaining.length)remaining=shuffledDeck(previous);
   const choice=remaining.shift();
   try{localStorage.setItem(KEY,JSON.stringify({day,choice,remaining}))}catch(e){}
   return COPY[choice];
 }
 function draw(element,entry){
   if(!element || !entry)return;
   const fragment=document.createDocumentFragment();
   entry.lines.forEach((line,i)=>{
     if(i)fragment.appendChild(document.createTextNode(' '));
     const span=document.createElement('span');
     span.className='morning-prayer-line';
     span.textContent=line;
     fragment.appendChild(span);
   });
   element.replaceChildren(fragment);
 }
 window.OnHaruMorningPrayer=Object.freeze({pick,draw,copy:COPY});
})();
