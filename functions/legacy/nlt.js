// Cloudflare Pages Function: same-origin NLT relay for the scripture-memory preview.
// This endpoint never persists, caches, or commits Scripture text.
const UPSTREAM='https://api.nlt.to/api/passages';
const headers={'Content-Type':'text/plain; charset=utf-8','Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};
const ALLOWED_REFERENCES=new Set(["1 Corinthians 13:4-5","1 Thessalonians 5:16-18","Philippians 4:6-7","Numbers 6:24-26","Isaiah 40:31","Isaiah 41:10","Jeremiah 29:11","1 Corinthians 16:14","Deuteronomy 6:6-7","Proverbs 16:3","Jeremiah 17:7-8","Mark 11:24","Psalm 143:8","Ephesians 3:16-17","Romans 15:13","Deuteronomy 31:8","Colossians 3:23-24","Psalm 121:7-8","John 11:25-26","2 Corinthians 5:7","Acts 16:31","Proverbs 3:5-6","Proverbs 3:3-4","Hebrews 11:1","Ephesians 4:2","Exodus 23:25","1 Corinthians 15:58","1 Corinthians 13:13","1 John 5:14","2 Kings 20:5","Joshua 1:9","Isaiah 25:1","Colossians 3:14","Romans 12:12","2 Corinthians 3:17","Psalm 20:4","Isaiah 43:2","Ephesians 5:15-16","Mark 9:23","Acts 16:25","2 Corinthians 9:7","Colossians 4:2","1 John 4:16","Jeremiah 29:12","Psalm 56:3","Ephesians 4:32","John 16:33","Isaiah 41:13","Matthew 11:28","Jeremiah 33:3","1 Corinthians 16:13","Psalm 133:1","Psalm 73:26","Galatians 5:22-23","1 Corinthians 1:10","1 Corinthians 6:9-10","1 Thessalonians 5:11","1 Chronicles 16:34","2 Chronicles 7:14","1 John 4:19","Psalm 42:11","Proverbs 17:9","Proverbs 4:23","Galatians 3:26-27","Isaiah 40:29","Proverbs 27:19","James 1:22","Ephesians 6:11","James 1:6","Romans 12:2","2 Corinthians 1:3-4","Hebrews 4:16","Jeremiah 29:13","John 15:13","Mark 10:27","Psalm 150:6","Psalm 147:3","Proverbs 17:17","Psalm 119:105","1 Corinthians 6:19-20","Philippians 4:13","Matthew 6:14","2 Timothy 1:7","1 Corinthians 15:57","1 John 1:9","Matthew 19:14","John 14:27","Deuteronomy 31:6","Proverbs 21:21","Proverbs 22:6","Matthew 18:20","Romans 11:36","John 15:16","Proverbs 28:13","Philippians 4:19","2 Timothy 3:16-17","1 Chronicles 29:14","Proverbs 11:25","Proverbs 2:6","Galatians 6:9"]);

export async function onRequestGet({request,env}){
  const url=new URL(request.url);
  const reference=(url.searchParams.get('ref')||'').trim();
  // Only one verse range in one book (max 50 verses); no open-proxy behavior.
  const match=/^([1-3]?\s?[A-Za-z ]{2,30})\s+(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/.exec(reference);
  if(!match)return new Response('Invalid scripture reference',{status:400,headers});
  if(!ALLOWED_REFERENCES.has(reference))return new Response('Passage not in OnHaru catalog',{status:403,headers});
  const begin=Number(match[3]),end=Number(match[4]||begin);
  if(begin<1||end<begin||end-begin>=50)return new Response('Invalid verse range',{status:400,headers});
  const key=(typeof env.NLT_API_KEY==='string'&&env.NLT_API_KEY.trim())?env.NLT_API_KEY:'TEST';
  const upstreamUrl=new URL(UPSTREAM);
  upstreamUrl.searchParams.set('ref',reference);
  upstreamUrl.searchParams.set('version','NLT');
  upstreamUrl.searchParams.set('key',key);
  try{
    const response=await fetch(upstreamUrl.toString(),{method:'GET',redirect:'follow',headers:{Accept:'text/html'}});
    if(!response.ok)return new Response('NLT provider unavailable ('+response.status+')',{status:response.status===429?429:502,headers});
    const type=response.headers.get('content-type')||'';
    if(!/html|text/.test(type))return new Response('Unexpected NLT response',{status:502,headers});
    const html=await response.text();
    if(!html||html.length>180000)return new Response('NLT passage unavailable',{status:502,headers});
    return new Response(html,{status:200,headers});
  }catch(error){
    console.error('OnHaru NLT upstream fetch failed:',error&&error.name,error&&error.message);
    return new Response('NLT connection unavailable',{status:502,headers});
  }
}
