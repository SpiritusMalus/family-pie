import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const cabinet=readFileSync(new URL('../site/vpn/cabinet/index.html',import.meta.url),'utf8');
const landing=readFileSync(new URL('../site/vpn/index.html',import.meta.url),'utf8');
test('all cabinet navigation and public deep links retain their destination screen',()=>{
 const screens=new Set([...cabinet.matchAll(/data-screen="([^"]+)"/g)].map(m=>m[1]));
 const routes=[...cabinet.matchAll(/data-route="([^"]+)"/g)].map(m=>m[1]);
 const publicRoutes=[...landing.matchAll(/href="\/vpn\/cabinet\/#([^?"#]+)/g)].map(m=>m[1]);
 assert.ok(routes.length>0);assert.ok(publicRoutes.length>0);
 for(const route of [...routes,...publicRoutes])assert.ok(screens.has(route),'Missing destination screen: '+route);
});
