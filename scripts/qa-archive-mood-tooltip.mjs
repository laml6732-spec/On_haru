import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const artifacts=process.env.ONHARU_ARTIFACTS||'test-results/archive-mood-tooltip';
await fs.mkdir(artifacts,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));
if(!executablePath)throw Error('Chrome browser missing');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report=[];
try {
  for (const width of [320,390,1024]) for (const theme of ['light','dark']) {
    const row={width,theme,passed:false};
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce',serviceWorkers:'block',locale:'en-US',timezoneId:'Pacific/Honolulu'});
    const page=await context.newPage();page.setDefaultTimeout(8000);
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    try{
      await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
      await page.goto(url,{waitUntil:'domcontentloaded'});
      await page.locator('#tutorialChooseEn').click();
      await page.locator('#welcomeSkip').click();
      await page.evaluate(t=>{
        document.getElementById('launchScreen')?.remove();
        const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
        document.documentElement.dataset.appearance=t;
        document.documentElement.style.colorScheme=t;
      },theme);
      const baseline=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
      await page.locator('.tabs [data-page="records"]').click();
      await page.locator('#rev-archive').click();
      await page.locator('.archive-mood-view-switch button').filter({hasText:'Mood'}).click();
      const info=page.locator('#archive-search .archive-mood-info');
      const summary=info.locator('summary');
      const tooltip=info.locator('.archive-mood-info-tooltip');
      await summary.waitFor();
      if(await info.evaluate(el=>el.open))throw Error('Info tooltip should be closed on initial calendar');
      if(await page.locator('#archive-search .archive-mood-legend').count())throw Error('Permanent legend still present');
      const summaryBox=await summary.boundingBox();
      if(!summaryBox||summaryBox.width<43.9||summaryBox.height<43.9)throw Error('Info target smaller than 44×44');
      await page.screenshot({path:artifacts+'/'+width+'-'+theme+'-closed.png',animations:'disabled'});
      await summary.click();
      if(!await info.evaluate(el=>el.open))throw Error('Info failed to expand');
      await tooltip.waitFor({state:'visible'});
      const text=await tooltip.innerText();
      if(!text.includes('Color: energy × mood')||!text.includes('Ring: energy only')||!text.includes('No dot: unrated'))throw Error('Legend explanation incomplete: '+text);
      const tooltipBox=await tooltip.boundingBox();
      if(!tooltipBox||tooltipBox.x<0||tooltipBox.x+tooltipBox.width>width+1)throw Error('Tooltip overflows viewport: '+JSON.stringify(tooltipBox));
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Horizontal overflow with tooltip open');
      await page.screenshot({path:artifacts+'/'+width+'-'+theme+'-open.png',animations:'disabled'});
      await summary.click();
      if(await info.evaluate(el=>el.open))throw Error('Info failed to collapse');
      await summary.focus();await page.keyboard.press('Enter');
      if(!await info.evaluate(el=>el.open))throw Error('Keyboard activation failed');
      await summary.click();
      await page.locator('#archive-search .archive-mood-arrow').first().click();
      if(!await page.locator('#archive-search .archive-mood-day').count())throw Error('Month navigation failed');
      const after=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
      if(after!==baseline)throw Error('Tooltip/month browsing changed user records');
      if(errors.length)throw Error('Page errors: '+errors.join('; '));
      row.passed=true;row.tooltip=tooltipBox;
      console.log('PASS',width,theme,'info toggle, keyboard, month navigation, no overflow/no record write');
    }catch(e){row.error=String(e);console.error('FAIL',width,theme,String(e))}
    report.push(row);await context.close();
  }
}finally{await browser.close();}
await fs.writeFile(artifacts+'/report.json',JSON.stringify(report,null,2));
if(report.some(x=>!x.passed))process.exitCode=1;
