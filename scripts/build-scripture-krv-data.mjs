#!/usr/bin/env node
// Build a local NKRV scripture dataset from user-supplied licensed text.
// This script does not retrieve or supply copyrighted scripture.
import fs from 'node:fs';
import path from 'node:path';
const [, , inputArg, outputArg, permissionFlag]=process.argv;
if(!inputArg||!outputArg||permissionFlag!=='--confirmed-license'){
 console.error('Usage: node scripts/build-scripture-krv-data.mjs <licensed-source.json> <output.json> --confirmed-license');
 process.exit(2);
}
const load=p=>JSON.parse(fs.readFileSync(path.resolve(p),'utf8'));
const catalog=load('data/scripture/nlt-popular-100.json');
let source=load(inputArg);
const bookCodes={
 '1 Corinthians':'1co','1 Thessalonians':'1th','Philippians':'php','Numbers':'num','Isaiah':'isa','Jeremiah':'jer',
 'Deuteronomy':'deu','Proverbs':'pro','Mark':'mrk','Psalm':'psa','Ephesians':'eph','Romans':'rom','Colossians':'col',
 'John':'jhn','2 Corinthians':'2co','Acts':'act','Hebrews':'heb','Exodus':'exo','1 John':'1jn','2 Kings':'2ki',
 'Joshua':'jos','Matthew':'mat','Galatians':'gal','1 Chronicles':'1ch','2 Chronicles':'2ch','James':'jas','2 Timothy':'2ti'
};
// Supported third-party SOURCE format: dev-dooD/bible-crawler bible_data.json,
// with books[].id, chapters[].chapter and verses[].text.GAE.
// Convert only the source ranges already selected for On_HARU; do not redistribute all 66 books.
if(Array.isArray(source?.books)&&source.books.length){
 const books=new Map(source.books.map(book=>[book.id,book]));
 source={translation:'NKRV',entries:catalog.entries.map(ref=>{
   const code=bookCodes[ref.book],book=books.get(code);
   if(!code||!book)throw Error('NKRV source missing book '+ref.book);
   const chapter=book.chapters?.find(ch=>Number(ch.chapter)===ref.chapter);
   if(!chapter)throw Error('NKRV source missing '+ref.reference);
   const verses=[];
   for(let verse=ref.verse_start;verse<=ref.verse_end;verse++){
      const record=chapter.verses?.find(v=>Number(v.verse)===verse);
      if(!record)throw Error('NKRV source missing '+ref.reference+' verse '+verse);
      verses.push({number:verse,text:record.text?.GAE});
   }
   return {id:ref.id,reference:ref.reference,verses};
 })};
}
const fail=message=>{throw new Error('NKRV import: '+message)};
if(!Array.isArray(catalog.entries)||catalog.entries.length!==100)fail('Missing 100-reference source catalog');
if(source?.translation!=='NKRV'||!Array.isArray(source?.entries)||source.entries.length!==100)fail('Expected 100 entries in NKRV input');
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
const body={schema_version:1,translation:'NKRV',language:'ko',source:'개역개정',
 copyright_holder:'대한성서공회',entries:output};
const target=path.resolve(outputArg);
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,JSON.stringify(body,null,2)+'\n');
console.log('Validated and wrote '+output.length+' licensed Korean passages to '+target);
