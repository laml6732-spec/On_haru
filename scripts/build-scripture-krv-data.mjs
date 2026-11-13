#!/usr/bin/env node
// Build a local KRV scripture dataset from user-supplied licensed text.
// This script does not retrieve or supply copyrighted scripture.
import fs from 'node:fs';
import path from 'node:path';
const [, , inputArg, outputArg, permissionFlag]=process.argv;
if(!inputArg||!outputArg||permissionFlag!=='--confirmed-license'){
 console.error('Usage: node scripts/build-scripture-krv-data.mjs <licensed-input.json> <output.json> --confirmed-license');
 process.exit(2);
}
const load=p=>JSON.parse(fs.readFileSync(path.resolve(p),'utf8'));
const catalog=load('data/scripture/nlt-popular-100.json');
const source=load(inputArg);
const fail=message=>{throw new Error('KRV import: '+message)};
if(!Array.isArray(catalog.entries)||catalog.entries.length!==100)fail('Missing 100-reference source catalog');
if(source?.translation!=='KRV'||!Array.isArray(source?.entries)||source.entries.length!==100)fail('Expected 100 entries in KRV input');
const keyed=new Map();
for(const entry of source.entries){
 if(typeof entry?.id!=='string'||keyed.has(entry.id))fail('Duplicate or invalid id');
 keyed.set(entry.id,entry);
}
const output=[];
for(const ref of catalog.entries){
 const item=keyed.get(ref.id),n=ref.verse_end-ref.verse_start+1;
 if(!item||item.reference!==ref.reference)fail('Missing or mismatched '+ref.reference);
 if(!Array.isArray(item.verses)||item.verses.length!==n)fail('Wrong verse count '+ref.reference);
 const verses=item.verses.map((v,i)=>{
  if(v?.number!==ref.verse_start+i||typeof v?.text!=='string'||!v.text.trim()||v.text.length>4000
     ||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v.text))fail('Invalid verse '+ref.reference);
  return {number:v.number,text:v.text};
 });
 output.push({id:ref.id,reference:ref.reference,verses});
}
if(keyed.size!==output.length)fail('Unexpected passage IDs');
const body={schema_version:1,translation:'KRV',language:'ko',source:'개역개정',
 copyright_holder:'대한성서공회',entries:output};
const target=path.resolve(outputArg);
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,JSON.stringify(body,null,2)+'\n');
console.log('Validated and wrote '+output.length+' licensed Korean passages to '+target);
