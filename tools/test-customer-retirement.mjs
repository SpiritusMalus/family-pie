import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {buildPortfolioSite} from './build-portfolio-site.mjs';

test('portfolio delivery excludes customer files and keeps independent working assets',async t=>{
  const directory=await mkdtemp(resolve('portfolio-site/dist-test-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await buildPortfolioSite(directory);
  for(const path of ['vpn','sufler'])await assert.rejects(access(resolve(directory,path)));
  for(const path of ['index.html','work/driftora/index.html','work/lumen-rest/index.html','rest_lumen/index.html','driftora/subscription/index.html','preview/showcase/index.html']) {
    const html=await readFile(resolve(directory,path),'utf8');
    assert.doesNotMatch(html,/(?:src|href)=["']\/(?:vpn|sufler)(?:\/|["'])/,path);
    assert.match(html,/href="\/assets\/fonts.css"/,path);
  }
  const fonts=await readFile(resolve(directory,'assets/fonts.css'),'utf8');
  for(const path of fonts.matchAll(/url\(\/(.*?)\)/g))await access(resolve(directory,path[1]));
  assert.deepEqual(await readFile(resolve(directory,'assets/portal.js')),await readFile('site/vpn/portal.js'));
  const sitemap=await readFile(resolve(directory,'sitemap.xml'),'utf8');
  assert.doesNotMatch(sitemap,/family-pie\.ru\/(vpn|sufler)(\/|<)/);
  assert.match(sitemap,/family-pie\.ru\/work\/driftora\//);
  assert.match(sitemap,/family-pie\.ru\/work\/lumen-rest\//);
});

test('portfolio builder preserves unmanaged files and refuses the canonical source',async t=>{
  const directory=await mkdtemp(resolve('portfolio-site/dist-test-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await writeFile(resolve(directory,'owner.txt'),'Keep');
  await assert.rejects(buildPortfolioSite(directory),/unmanaged/);
  assert.equal(await readFile(resolve(directory,'owner.txt'),'utf8'),'Keep');
  await assert.rejects(buildPortfolioSite(resolve('site')),/unsafe/);
});

test('retirement worker removes only its shell cache and migrates owned VPN windows',async()=>{
  const listeners={},deleted=[],navigated=[];let installed=false,unregistered=false;
  const window=url=>({url,navigate:async target=>{navigated.push(target);}});
  const context={URL,caches:{keys:async()=>['family-vpn-shell-v1','family-vpn-shell-20261006-social','portfolio','another-app'],delete:async key=>deleted.push(key)},self:{location:{origin:'https://family-pie.ru'},skipWaiting:async()=>{installed=true;},registration:{unregister:async()=>{unregistered=true;}},clients:{matchAll:async()=>[window('https://family-pie.ru/vpn/cabinet/?lang=en#settings'),window('https://family-pie.ru/vpn'),window('https://family-pie.ru/'),window('https://family-pie.ru/vpn-other/'),window('https://elsewhere.invalid/vpn/')]},addEventListener:(name,handler)=>{listeners[name]=handler;}}};
  vm.runInNewContext(await readFile('site/retire-customer-worker.js','utf8'),context);
  let done;listeners.install({waitUntil:p=>{done=p;}});await done;assert.equal(installed,true);
  listeners.activate({waitUntil:p=>{done=p;}});await done;
  assert.deepEqual(deleted,['family-vpn-shell-v1','family-vpn-shell-20261006-social']);
  assert.equal(unregistered,true);
  assert.deepEqual(navigated,['https://family-spy.ru/vpn/cabinet/?lang=en#settings','https://family-spy.ru/vpn']);
});
