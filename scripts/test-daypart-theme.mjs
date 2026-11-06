import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../public/legacy/runtime/daypart-theme.v1.js', import.meta.url),'utf8');
const html = readFileSync(new URL('../public/legacy/index.html', import.meta.url),'utf8');
const sw = readFileSync(new URL('../public/legacy/sw.js', import.meta.url),'utf8');
const manifest = JSON.parse(readFileSync(new URL('../public/legacy/manifest.webmanifest', import.meta.url),'utf8'));

function fixture() {
 let hour=4;
 const handlers={};
 const interval=[];
 const root={dataset:{}};
 const icon={href:'./icons/onharu-face-wave-512.png'};
 const canvasCalls=[];
 const document={
  documentElement:root,hidden:false,
  getElementById:id=>id==='onharu-tab-icon'?icon:null,
  createElement:()=>({
   width:0,height:0,
   getContext:()=>({
     filter:'',globalCompositeOperation:'',fillStyle:'',
     drawImage(){ canvasCalls.push('draw'); },
     fillRect(){canvasCalls.push('overlay');}
   }),
   toDataURL:()=> 'data:image/png;base64,'+Buffer.from(root.dataset.onharuDaypart).toString('base64')
  }),
  addEventListener:(name,handler)=>{handlers[name]=handler;}
 };
 const win={
   addEventListener:(name,handler)=>{handlers[name]=handler;},
   setInterval:(callback,ms)=>{interval.push({callback,ms});}
 };
 class FixedDate extends Date { constructor(...args){super(...(args.length?args:[new Date(2026,10,5,hour).getTime()]));} }
 class FakeImage {
   naturalWidth=512;
   set src(_value){this.onload?.();}
 }
 const context={window:win,document,Date:FixedDate,Image:FakeImage,Buffer};
 vm.runInNewContext(script,context,{filename:'daypart-theme.v1.js'});
 return {setHour:h=>hour=h,root,icon,handlers,interval,win,canvasCalls};
}
test('four device-local time windows and exact boundaries',()=>{
 const f=fixture();
 const cases=[[0,'night'],[4,'night'],[5,'morning'],[10,'morning'],[11,'day'],[16,'day'],[17,'evening'],[19,'evening'],[20,'night'],[23,'night']];
 for(const [hour,expected] of cases){f.setHour(hour);assert.equal(f.win.OnHaruDaypart.refresh(),expected,'hour '+hour);assert.equal(f.root.dataset.onharuDaypart,expected);}
});
test('dynamic tab favicon changes, but fixed install manifest remains original',()=>{
 const f=fixture();assert.match(f.icon.href,/^data:image\/png;base64,/);
 f.setHour(11);f.win.OnHaruDaypart.refresh();
 assert.equal(f.icon.href,'./icons/onharu-face-wave-512.png');
 f.setHour(17);f.win.OnHaruDaypart.refresh();
 assert.match(f.icon.href,/^data:image\/png;base64,/);
 assert.equal(manifest.icons.length,2);
 assert.ok(manifest.icons.every(i=>i.src.includes('onharu-face-wave-')));
 assert.ok(!JSON.stringify(manifest).includes('daypart'));
 assert.ok(f.canvasCalls.length>0);
});
test('idle timer and foreground events refresh daypart',()=>{
 const f=fixture();assert.equal(f.interval.length,1);assert.equal(f.interval[0].ms,60000);
 f.setHour(9);f.handlers.visibilitychange();
 assert.equal(f.root.dataset.onharuDaypart,'morning');
 f.setHour(12);f.handlers.focus();assert.equal(f.root.dataset.onharuDaypart,'day');
 f.setHour(20);f.interval[0].callback();assert.equal(f.root.dataset.onharuDaypart,'night');
});
test('HTML splash remains original and new script precached with matching release',()=>{
 assert.match(html,/id="launchArt"/);
 assert.match(html,/onharu-launch-v3\.png/);
 assert.match(html,/onharu-daypart-theme/);
 assert.match(html,/data-onharu-daypart="morning"/);
 assert.match(html,/data-onharu-daypart="night"/);
 assert.match(sw,/\.\/runtime\/daypart-theme\.v1\.js/);
 assert.equal(html.match(/name="kona-release" content="([a-z0-9]+)"/)?.[1],sw.match(/const RELEASE='([^']+)'/)?.[1]);
});
