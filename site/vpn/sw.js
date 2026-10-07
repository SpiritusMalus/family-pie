const CACHE='family-vpn-shell-20261006-social';
const ASSETS=['/social-footer.css','/vpn/offline.html','/vpn/style.css','/vpn/portal-style.css','/vpn/fonts.css','/vpn/favicon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('family-vpn-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==self.location.origin||u.pathname.startsWith('/vpn/api/'))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/vpn/offline.html')));return;}if(ASSETS.includes(u.pathname))e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});
self.addEventListener('push',e=>{let data;try{data=e.data.json();}catch{return;}e.waitUntil(self.registration.showNotification(String(data.title||'Family VPN').slice(0,80),{body:String(data.body||'').slice(0,240),tag:String(data.tag||'family-vpn').slice(0,200),icon:'/vpn/favicon.svg',data:{url:'/vpn/cabinet/#home'}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow('/vpn/cabinet/#home'));});
