// Change the delivery host, never the subscription identity stored in SQLite.
export function subscriptionURL(value, origin) {
 if (!value || !origin) return value;
 let url;
 try { url = new URL(value); } catch { return value; }
 if (url.protocol !== 'https:' || url.hostname !== 'sub.family-pie.ru' ||
     !['', '2096'].includes(url.port) || url.username || url.password ||
     !/^\/sub\/[A-Za-z0-9_-]+$/.test(url.pathname)) return value;
 return origin + url.pathname + url.search + url.hash;
}

export function subscriptionOrigin(value) {
 if (!value) return null;
 const url = new URL(value);
 if (url.origin !== value || url.protocol !== 'https:') throw new Error('Invalid subscription origin');
 return value;
}
