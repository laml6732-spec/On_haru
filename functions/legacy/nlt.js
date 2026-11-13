// Cloudflare Pages Function: same-origin NLT relay for the scripture-memory preview.
// This endpoint never persists, caches, or commits Scripture text.
const UPSTREAM='https://api.nlt.to/api/passages';
const headers={'Content-Type':'text/plain; charset=utf-8','Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};

export async function onRequestGet({request,env}){
  const url=new URL(request.url);
  const reference=(url.searchParams.get('ref')||'').trim();
  // Only one verse range in one book (max 50 verses); no open-proxy behavior.
  const match=/^([1-3]?\s?[A-Za-z ]{2,30})\s+(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/.exec(reference);
  if(!match)return new Response('Invalid scripture reference',{status:400,headers});
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
