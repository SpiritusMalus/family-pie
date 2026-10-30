import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {runInNewContext} from 'node:vm';
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
  assert.match(html,/<title[^>]*>Купить ВПН для телефона и компьютера/);
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
  for(const path of ['/vpn','/vpn/index.html']){
    const r=await fetch(base+path+'?lang=en&period=90',{redirect:'manual'});
    assert.equal(r.status,301);assert.equal(r.headers.get('location'),'/vpn/?lang=en&period=90');
  }
  const account=await fetch(base+'/vpn/cabinet/auth/?mode=register&period=180');assert.equal(account.status,200);assert.match(await account.text(),/noindex,nofollow/);
  const missing=await fetch(base+'/vpn/not-a-real-page');assert.equal(missing.status,404);assert.doesNotMatch(await missing.text(),/id="vpn-title"/);
  const head=await fetch(base+'/vpn/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await fetch(base+'/vpn/',{method:'POST'})).status,405);
});

const homeVpnScript = await readFile(new URL('../customer-site/home-vpn.js',import.meta.url),'utf8');
function homeAnchorFixture(url) {
  const initial = new URL(url), replacements = [], listeners = new Map();
  const location = {
    pathname:initial.pathname,search:initial.search,hash:initial.hash,
    replace(value) {
      replacements.push(value);
      const next = new URL(value,initial);
      this.pathname=next.pathname;this.search=next.search;this.hash=next.hash;
    }
  };
  // The real script receives no document, fetch, cookies or storage APIs.
  runInNewContext(homeVpnScript,{
    location,window:{addEventListener:(type,listener)=>listeners.set(type,listener)}
  });
  return {location,replacements,listeners,hashchange(hash) {
    location.hash=hash;listeners.get('hashchange')?.();
  }};
}

test('legacy homepage VPN anchors: initial links preserve every query field and the exact target fragment',()=>{
  for(const path of ['/','/index.html'])for(const hash of ['#vpn-features','#vpn-pricing']) {
    const query='?lang=ru&period=90&return=%2Fvpn%2Fcabinet%2F%23plans&lang=en&extra=a%2Bb';
    const f=homeAnchorFixture('https://family-spy.ru'+path+query+hash);
    assert.deepEqual(f.replacements,['/vpn/'+query+hash]);
    assert.equal(f.location.pathname,'/vpn/');
    f.hashchange(hash);
    assert.equal(f.replacements.length,1,'The dedicated destination must not redirect again');
  }
  assert.deepEqual(homeAnchorFixture('https://family-spy.ru/#vpn-pricing').replacements,['/vpn/#vpn-pricing']);
});

test('legacy homepage VPN anchors: later hash changes follow only the two legacy targets',()=>{
  for(const path of ['/','/index.html'])for(const hash of ['#vpn-features','#vpn-pricing']) {
    const f=homeAnchorFixture('https://family-spy.ru'+path+'?lang=en#sufler');
    assert.deepEqual(f.replacements,[]);
    f.hashchange('#vpn');assert.deepEqual(f.replacements,[]);
    f.hashchange(hash);assert.deepEqual(f.replacements,['/vpn/?lang=en'+hash]);
  }
});

test('legacy homepage VPN anchors: unknown and lookalike fragments stay on the homepage',()=>{
  for(const hash of ['', '#', '#vpn', '#sufler', '#vpn-questions', '#VPN-features', '#vpn-features/', '#vpn-pricing?period=90', '#vpn-pricing-extra', '#vpn%2Dfeatures', '#https://elsewhere.invalid/']) {
    const f=homeAnchorFixture('https://family-spy.ru/?lang=ru'+hash);
    assert.deepEqual(f.replacements,[],hash);
    f.hashchange(hash);assert.deepEqual(f.replacements,[],hash);
  }
});

test('legacy homepage VPN anchors: dedicated, account and unrelated paths never acquire a redirect handler',()=>{
  for(const path of ['/vpn/','/vpn','/vpn/index.html','/vpn/cabinet/','/vpn/cabinet/auth/','/vpn/api/plans','/sufler/','/other/','/index.html/','/index.htm'])for(const hash of ['#vpn-features','#vpn-pricing']) {
    const f=homeAnchorFixture('https://family-spy.ru'+path+'?lang=ru'+hash);
    assert.deepEqual(f.replacements,[],path);
    assert.equal(f.listeners.size,0,path);
    f.hashchange(hash);assert.deepEqual(f.replacements,[],path);
  }
});
