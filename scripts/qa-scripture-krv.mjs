// Korean scripture data import integration QA with synthetic text only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';

const root=process.cwd(),base=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const output=path.resolve(root,'public/legacy/data/scripture-memory-100.ko-nkrv.json');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'onharu-krv-'));
const input=path.join(dir,'synthetic-input.json');
const catalog=JSON.parse(fs.readFileSync('data/scripture/nlt-popular-100.json','utf8'));
const fixture={
 translation:'NKRV',
 entries:catalog.entries.map(e=>({id:e.id,reference:e.reference,
  verses:Array.from({length:e.verse_end-e.verse_start+1},(_,i)=>({number:e.verse_start+i,text:'테스트 전용 임시 문장 '+e.id+' '+(e.verse_start+i)}))}))
};
const attempt=(args)=>execFileSync(process.execPath,['scripts/build-scripture-krv-data.mjs',...args],{cwd:root,stdio:'pipe',encoding:'utf8'});
fs.writeFileSync(input,JSON.stringify(fixture),'utf8');
let browser;
try{
  attempt([input,output,'--confirmed-license']);
  const content=JSON.parse(fs.readFileSync(output,'utf8'));
  if(content.translation!=='NKRV'||content.entries.length!==100)throw Error('NKRV output validation');
  const corrupted=structuredClone(fixture);corrupted.entries[0].verses[0].number=99;
  const bad=path.join(dir,'invalid.json');fs.writeFileSync(bad,JSON.stringify(corrupted));
  let rejected=false;try{attempt([bad,path.join(dir,'never.json'),'--confirmed-license']);}catch{rejected=true;}
  if(!rejected)throw Error('Verse mismatch must fail');
  // Check direct extraction of exactly the selected ranges from the discovered
  // GAE (개역개정) crawler JSON shape, with synthetic data ONLY.
  const codes={'1 Corinthians':'1co','1 Thessalonians':'1th','Philippians':'php','Numbers':'num','Isaiah':'isa',
   'Jeremiah':'jer','Deuteronomy':'deu','Proverbs':'pro','Mark':'mrk','Psalm':'psa','Ephesians':'eph','Romans':'rom',
   'Colossians':'col','John':'jhn','2 Corinthians':'2co','Acts':'act','Hebrews':'heb','Exodus':'exo',
   '1 John':'1jn','2 Kings':'2ki','Joshua':'jos','Matthew':'mat','Galatians':'gal','1 Chronicles':'1ch',
   '2 Chronicles':'2ch','James':'jas','2 Timothy':'2ti'};
  const sources=new Map();
  for(const item of catalog.entries){
    const id=codes[item.book];if(!id)throw Error('Missing code '+item.book);
    if(!sources.has(id))sources.set(id,{id,chapters:[]});
    const book=sources.get(id);
    let ch=book.chapters.find(x=>x.chapter===item.chapter);
    if(!ch){ch={chapter:item.chapter,verses:[]};book.chapters.push(ch);}
    for(let n=item.verse_start;n<=item.verse_end;n++){
      if(!ch.verses.some(x=>x.verse===n))ch.verses.push({verse:n,text:{GAE:'테스트 전용 임시 문장 '+item.id+' '+n}});
    }
  }
  const crawler=path.join(dir,'synthetic-bible-data.json');
  fs.writeFileSync(crawler,JSON.stringify({metadata:{source:'synthetic',versions:['GAE']},books:[...sources.values()]}));
  const fromCrawler=path.join(dir,'from-crawler.json');
  attempt([crawler,fromCrawler,'--confirmed-license']);
  const compiled=JSON.parse(fs.readFileSync(fromCrawler,'utf8'));
  if(compiled.entries.length!==100||compiled.entries.reduce((n,x)=>n+x.verses.length,0)!==121)throw Error('Crawler conversion did not yield 100 passages/121 verses');

  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const reports=[];
  for(const [width,theme] of [[320,'light'],[390,'dark'],[1024,'light']]){
    const context=await browser.newContext({viewport:{width,height:844},colorScheme:theme,
      isMobile:width<600,hasTouch:width<600,timezoneId:'Pacific/Honolulu',serviceWorkers:'block'});
    const page=await context.newPage();const errors=[];page.on('pageerror',err=>errors.push(String(err)));
    await page.route('**/legacy/nlt?*',route=>route.fulfill({status:200,contentType:'text/html',body:'<p>English synthetic test text.</p>'}));
    try{
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.locator('#tutorialChooseKo').click();
      await page.locator('#welcomeSkip').click();
      await page.locator('#sm-write-cue').waitFor({state:'visible'});
      await page.locator('#sm-write-cue').click();
      await page.locator('.sm-verse').first().waitFor({state:'visible'});
      const koreanCount=await page.locator('.sm-verse').count();
      if(koreanCount!==2)throw Error('Korean full-body verse count mismatch '+koreanCount);
      const first=await page.locator('.sm-verse').first().innerText();
      if(!first.includes('테스트 전용 임시 문장'))throw Error('Korean stored text not used');
      const label=await page.locator('.sm-reference').innerText();
      if(!label.includes('개역개정'))throw Error('Incorrect translation label: '+label);
      await page.getByRole('button',{name:'English · NLT'}).click();
      await page.locator('.sm-verse').first().waitFor();
      const english=await page.locator('.sm-verse').first().innerText();
      if(!english.includes('English synthetic test text'))throw Error('English translation toggle failed');
      await page.getByRole('button',{name:'한국어 · 개역개정'}).click();
      const again=await page.locator('.sm-verse').first().innerText();
      if(!again.includes('테스트 전용 임시 문장'))throw Error('Korean translation toggle-back failed');
      const dim=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
      if(dim.scroll>dim.client+2)throw Error('Horizontal overflow');
      if(errors.length)throw Error('Browser errors: '+errors.join('; '));
      reports.push({width,theme,result:'pass',koreanVerseCount:koreanCount});
    }finally{await context.close()}
  }
  console.log(JSON.stringify({import:'pass',reject_corrupt:'pass',responsive:reports},null,2));
}finally{
  if(browser)await browser.close();
  if(fs.existsSync(output))fs.unlinkSync(output);
  fs.rmSync(dir,{recursive:true,force:true});
}
