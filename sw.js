/* Cache only application code, never user records. Bump version with code changes. */
const CACHE_NAME='deutsch-trainer-static-v1.8.0';
const ASSETS=['./','./index.html','./styles.css?v=1.8.0','./spaced.js?v=1.8.0','./duo-game.js?v=1.8.0','./app.js?v=1.8.0','./manifest.webmanifest','./ukazkove-slovicka.json','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('deutsch-trainer-static-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  event.respondWith(fetch(req).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(req,copy)).catch(()=>{});}
    return response;
  }).catch(()=>caches.match(req).then(cached=>cached||caches.match('./index.html'))));
});
