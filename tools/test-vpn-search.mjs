import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {buildCustomerSite} from './build-customer-site.mjs';
import {buildVpnLanding} from './build-vpn-landing.mjs';

test('VPN search page has crawlable product content, one heading and honest structured data',async t=>{
  const directory=await mkdtemp(resolve('customer-site/dist-test-search-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await buildCustomerSite(directory);
  const html=await readFile(resolve(directory,'vpn/index.html'),'utf8');
  assert.match(html,/<html lang="ru"/);
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.match(html,/<h1 id="vpn-title"><span>Family<\/span> <span>VPN<\/span><\/h1>/);
  assert.match(html,/<h2[^>]*data-ru="В одной подписке"/);
  assert.match(html,/<h3[^>]*data-ru="Без лимита устройств"/);
  assert.match(html,/<title[^>]*>Купить VPN-подписку/);
  assert.match(html,/<link rel="canonical" href="https:\/\/family-spy\.ru\/vpn\/">/);
  assert.doesNotMatch(html,/<meta name="robots"[^>]*noindex/);
  for(const content of ['Family VPN — VPN-сервис от Family Spy','Как купить VPN-подписку?','Как подключить ВПН после оплаты?','Android TV и Apple TV','нет лимита устройств']) assert.ok(html.includes(content),content);
  assert.doesNotMatch(html,/<section id="sufler"|href="#sufler"|<article><h3>Sufler<\/h3>/);
  const structured=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  assert.equal(structured.find(s=>s['@type']==='WebSite').name,'Family Spy');
  const service=structured.find(s=>s['@type']==='Service');
  assert.equal(service.name,'Family VPN');assert.equal(service.brand.name,'Family Spy');
  assert.equal(service.url,'https://family-spy.ru/vpn/');
  assert.equal(service.offers,undefined);assert.equal(service.aggregateRating,undefined);
  assert.doesNotMatch(html,/100%|24\/7|полная анонимность|лучший VPN|гарантированная скорость/i);
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  for(const match of html.matchAll(/href="#([^"?]+)"/g))assert.ok(ids.has(match[1]),'Broken local anchor '+match[1]);
  for(const days of [30,90,180,365])assert.match(html,new RegExp('href="/vpn/cabinet/#plans\\?period='+days+'"'));
  // Current amounts remain the existing read-only API's responsibility, with a useful static fallback.
  assert.match(html,/Тарифы в личном кабинете/);assert.doesNotMatch(html,/"price"\s*:|"priceCurrency"\s*:/);
  const home=await readFile(resolve(directory,'index.html'),'utf8');
  assert.match(home,/href="\/vpn\/"/);
  const sitemap=await readFile(resolve(directory,'sitemap.xml'),'utf8');
  assert.equal((sitemap.match(/<loc>https:\/\/family-spy\.ru\/vpn\/<\/loc>/g)||[]).length,1);
  assert.doesNotMatch(sitemap,/\/cabinet|\/admin|\/api\/|\/vpn\/index\.html/);
  for(const path of ['vpn/cabinet/index.html','vpn/cabinet/auth/index.html','vpn/admin/index.html'])assert.match(await readFile(resolve(directory,path),'utf8'),/<meta name="robots" content="noindex,nofollow">/);
});

test('VPN generation refuses to silently lose its shared storefront sections',()=>{
  for(const home of ['','<section id="vpn"','<section id="vpn"><section id="sufler"'])assert.throws(()=>buildVpnLanding(home,''),/Missing storefront section/);
});

test('Family VPN setup and help remain crawlable, connected and separate from private account state',async t=>{
  const directory=await mkdtemp(resolve('customer-site/dist-test-guides-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await buildCustomerSite(directory);
  const sitemap=await readFile(resolve(directory,'sitemap.xml'),'utf8');
  assert.doesNotMatch(sitemap,/happ/i);
  for (const [route,type] of [['/vpn/setup/','TechArticle'],['/vpn/help/connection/','TechArticle']]) {
    const html=await readFile(resolve(directory,'.'+route,'index.html'),'utf8');
    assert.equal((html.match(/<h1\b/g)||[]).length,1);
    assert.doesNotMatch(html.match(/<title[^>]*>[\s\S]*?<\/title>/)[0],/Happ/i);
    assert.doesNotMatch(html.match(/<h1[^>]*>[\s\S]*?<\/h1>/)[0],/Happ/i);
    assert.doesNotMatch(html.match(/<meta name="description"[^>]*>/)[0],/Happ/i);
    assert.equal((html.match(/href="\/vpn-guides.css"/g)||[]).length,1);
    assert.ok(html.includes(`<link rel="canonical" href="https://family-spy.ru${route}">`));
    assert.ok(sitemap.includes(`<loc>https://family-spy.ru${route}</loc>`));
    assert.doesNotMatch(html,/<meta name="robots"[^>]*noindex|happ:\/\/crypto|vless:\/\/|"aggregateRating"|"priceCurrency"/);
    const schema=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
    assert.equal(schema.length,1);assert.equal(schema[0]['@type'],type);assert.equal(schema[0].url,'https://family-spy.ru'+route);
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(new Set(ids).size,ids.length,'Duplicate anchors on '+route);
    for(const [,anchor] of html.matchAll(/href="#([^"?]+)"/g))assert.ok(ids.includes(anchor),'Broken anchor '+anchor+' on '+route);
    assert.match(html,/support_vpn/);
    for (const [,url] of html.matchAll(/href="(\/[^"#?]*)[^" ]*"/g)) {
      if (url.startsWith('//')) continue;
      const file=resolve(directory,'.'+url+(url.endsWith('/')?'index.html':''));
      await readFile(file);
    }
  }
  const setup=await readFile(resolve(directory,'vpn/setup/index.html'),'utf8');
  assert.doesNotMatch(setup.match(/<title[^>]*>[\s\S]*?<\/title>/)[0],/Happ/i);
  assert.match(setup,/Проверь возможность установки до покупки подписки/);
  assert.doesNotMatch(setup,/data-device-scene|name="hero-device"/);
  assert.doesNotMatch(setup,/data-vpn-plan=/);
  assert.match(setup,/href="\/vpn\/#vpn-pricing"/);
  for(const id of ['android','windows','ios'])assert.ok(setup.includes(`id="setup-${id}"`));
  assert.match(await readFile(resolve(directory,'vpn/index.html'),'utf8'),/href="\/vpn\/setup\/"/);
  // Ownership proofs remain inherited without introducing a second configuration surface.
  await buildCustomerSite(directory,{googleSiteVerification:'fixture-google',yandexSiteVerification:'fixture-yandex'});
  for(const route of ['vpn/setup','vpn/help/connection'])assert.match(await readFile(resolve(directory,route,'index.html'),'utf8'),/name="google-site-verification" content="fixture-google"/);
});

test('public VPN routes serve the landing, canonical aliases preserve queries, private routes stay separate',async t=>{
  const child=spawn(process.execPath,['tools/serve-customer-site.mjs','0'],{cwd:resolve('.'),stdio:['ignore','pipe','pipe']});
  let errors='';child.stderr.on('data',b=>{errors+=b;});
  t.after(async()=>{if(child.exitCode===null){child.kill();await once(child,'exit');}});
  const base=await new Promise((resolve,reject)=>{
    let text='';const timeout=setTimeout(()=>reject(Error('Preview start timed out: '+errors)),15000);
    child.once('exit',code=>{clearTimeout(timeout);reject(Error('Preview exited '+code+': '+errors));});
    child.stdout.on('data',b=>{text+=b;const match=text.match(/http:\/\/localhost:(\d+)\//);if(match){clearTimeout(timeout);resolve('http://127.0.0.1:'+match[1]);}});
  });
  const response=await fetch(base+'/vpn/');assert.equal(response.status,200);
  const html=await response.text();assert.match(html,/id="vpn-questions"/);assert.match(html,/href="\/vpn\/cabinet\/"/);
  for(const path of ['/vpn/setup/','/vpn/help/connection/']) {
    const r=await fetch(base+path);assert.equal(r.status,200);assert.match(await r.text(),/href="\/vpn-guides.css"/);
  }
  for(const path of ['/vpn','/vpn/index.html']){
    const r=await fetch(base+path+'?lang=en&period=90',{redirect:'manual'});
    assert.equal(r.status,301);assert.equal(r.headers.get('location'),'/vpn/?lang=en&period=90');
  }
  for(const route of ['/vpn/setup/','/vpn/help/connection/'])for(const path of [route.slice(0,-1),route+'index.html']){
    const r=await fetch(base+path+'?lang=en&period=90',{redirect:'manual'});
    assert.equal(r.status,301);assert.equal(r.headers.get('location'),route+'?lang=en&period=90');
  }
  const retired=await fetch(base+'/vpn/happ/?lang=en',{redirect:'manual'});assert.equal(retired.status,301);assert.equal(retired.headers.get('location'),'/vpn/?lang=en');
  const account=await fetch(base+'/vpn/cabinet/auth/?mode=register&period=180');assert.equal(account.status,200);assert.match(await account.text(),/noindex,nofollow/);
  const missing=await fetch(base+'/vpn/not-a-real-page');assert.equal(missing.status,404);assert.doesNotMatch(await missing.text(),/id="vpn-title"/);
  const head=await fetch(base+'/vpn/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await fetch(base+'/vpn/',{method:'POST'})).status,405);
});
