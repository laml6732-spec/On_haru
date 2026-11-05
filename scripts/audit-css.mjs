#!/usr/bin/env node
// Read-only CSS inventory. Reports likely conflicts; never auto-deletes rules.
import fs from 'node:fs';
const file=process.argv.slice(2).find(arg=>!arg.startsWith('--'))||'public/legacy/app.7cb1b71d4eb6.css';
const css=fs.readFileSync(file,'utf8');
const clean=css.replace(/\/\*[\s\S]*?\*\//g,'');
const selectors=[];
for(const match of clean.matchAll(/(?:^|\})\s*([^{}]+?)\s*\{/g)){
 const raw=match[1].trim();
 if(!raw||raw.startsWith('@')||raw.includes(';'))continue;
 selectors.push(raw.replace(/\s+/g,' '));
}
const counts=new Map();
for(const s of selectors)counts.set(s,(counts.get(s)||0)+1);
const repeat=[...counts].filter(([,n])=>n>1).sort((a,b)=>b[1]-a[1]);
const colorCount=(clean.match(/#[0-9a-fA-F]{3,8}\b/g)||[]).length;
const dark=(clean.match(/(?:html|:root)\[data-appearance\s*=\s*["']?dark["']?\]/g)||[]).length;
const data={
 file,bytes:Buffer.byteLength(css),lines:css.split('\n').length,
 ruleOpenBraces:(clean.match(/\{/g)||[]).length,
 important:(clean.match(/!important/g)||[]).length,
 selectorGroups:selectors.length,uniqueSelectorGroups:counts.size,
 repeatedSelectorGroups:repeat.length,
 hexColorMentions:colorCount,darkThemeSelectorMentions:dark,
 repeatTop:repeat.slice(0,25).map(([selector,count])=>({count,selector})),
 riskFlags:{
  blanketDarkColorInheritance:clean.includes('body .app *{color:inherit!important'),
  hardCodedCaptureNoteInk:clean.includes('.capture-recent-body{font-size:')&&clean.includes('color:#2e4b3e!important'),
  darkMemoOverride:clean.includes('/* On_HARU: readable dark-theme note content. */')||css.includes('/* On_HARU: readable dark-theme note content. */')
 }
};
if(process.argv.includes('--json'))console.log(JSON.stringify(data,null,2));
else{
 console.log('CSS inventory:',file,'\nsize:',data.bytes,'bytes; !important:',data.important,'; selector groups:',data.selectorGroups);
 console.log('Exact repeated selector groups:',data.repeatedSelectorGroups,'; dark selector mentions:',data.darkThemeSelectorMentions);
 console.log('Potential conflicts:',JSON.stringify(data.riskFlags));
 console.log('\nRepeated selector groups (top 25):');
 for(const item of data.repeatTop)console.log(String(item.count).padStart(3),item.selector.slice(0,180));
 console.log('\nIMPORTANT: This report is diagnostic only; do not delete repeated selectors without responsive/light/dark screenshot comparisons.');
}
