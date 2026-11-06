/* Minimal offline-first app shell; images are cached only when requested. */
const PREFIX='kona-legacy-shell-'; // Keep prefix: clean up old 18 MB versioned caches.
const RELEASE='moodhierarchyv120261106';
const CACHE=PREFIX+RELEASE;
const MEDIA=PREFIX+'media-'+RELEASE;
const CORE=["./runtime/daypart-theme.v1.js","./runtime/install-metrics.v1.js","./runtime/settings.58b48f87b05a.js?rev=moodhierarchyv120261106","./assets/onharu-launch-v3.png","./assets/onharu-welcome.png","./icons/onharu-face-wave-512.png","./","./index.html","./app.7cb1b71d4eb6.css?rev=moodhierarchyv120261106","./runtime/legacy-controllers.9a6fbb5e22cc.js?rev=moodhierarchyv120261106","./review-hierarchy.v1.css?rev=moodhierarchyv120261106","./manifest.webmanifest","./icons/onharu-face-wave-192.png"];
const home=new URL('./',self.registration.scope).href;
const MAX_MEDIA_ENTRIES=16;
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE&&k!==MEDIA).map(k=>caches.delete(k)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request, url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(home))return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(async res=>{
   if(res.ok){
    // Keep this cache an internally consistent offline release.
    const html=await res.clone().text();
    if(html.includes('name="kona-release" content="'+RELEASE+'"')){const c=await caches.open(CACHE);await c.put(home,res.clone()).catch(()=>{});}
   }
   return res;
  }).catch(async()=>await (await caches.open(CACHE)).match(home)||Response.error()));
  return;
 }
 const isCore=CORE.some(p=>new URL(p,self.registration.scope).href===url.href);
 if(isCore){event.respondWith(caches.open(CACHE).then(async c=>await c.match(req)||fetch(req).then(res=>{if(res.ok)c.put(req,res.clone()).catch(()=>{});return res;})));return;}
 const isMedia=/\.(png|jpe?g|webp|svg|gif)$/i.test(url.pathname);
 if(isMedia){event.respondWith((async()=>{
  const c=await caches.open(MEDIA), hit=await c.match(req);
  if(hit)return hit;
  try{const res=await fetch(req);if(res.ok){await c.put(req,res.clone()).catch(()=>{});
   const keys=await c.keys();if(keys.length>MAX_MEDIA_ENTRIES)await Promise.all(keys.slice(0,keys.length-MAX_MEDIA_ENTRIES).map(k=>c.delete(k)));}
   return res;
  }catch{return Response.error();}
 })());}
});
