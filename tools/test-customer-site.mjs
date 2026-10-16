import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildCustomerSite,canonicalCustomerFlow,publicPlans} from './build-customer-site.mjs';

test('standalone customer artifact includes account/payment pages without portfolio',async t=>{
  const directory=await mkdtemp(resolve('customer-site/dist-test-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const {output}=await buildCustomerSite(directory);
  for(const path of ['index.html','vpn/index.html','vpn/terms/index.html','sufler/index.html','sufler/setup/index.html','sufler/privacy/index.html','i18n/language.js','vpn/fonts.css','vpn/cabinet/index.html','vpn/cabinet/auth/index.html','vpn/admin/index.html','sufler/buy/index.html','sufler/buy/done/index.html'])await access(resolve(output,path));
  for(const path of ['work','preview','rest_lumen','driftora'])await assert.rejects(access(resolve(output,path)));
  const home=await readFile(resolve(output,'index.html'),'utf8');
  assert.doesNotMatch(home,/Eugene|Евгений|LinkedIn|SpiritusMalus|portrait/);
  const sufler=await readFile(resolve(output,'sufler/index.html'),'utf8');
  assert.doesNotMatch(sufler,/fp-social|linkedin\.com/);
  assert.match(sufler,/https:\/\/family-spy\.ru\/sufler\//);
  assert.match(sufler,/href="\/sufler\/download\/Sufler-Setup-0\.2\.0-x64\.exe"/);
  for(const route of ['sufler/index.html','sufler/setup/index.html','sufler/terms/index.html','sufler/privacy/index.html']) {
    const html=await readFile(resolve(output,route),'utf8');
    assert.match(html,/<a class="brand"[^>]*>family-spy <span>\/ Sufler<\/span>/,route);
    assert.doesNotMatch(html,/<a class="brand"[^>]*>family-pie/,route);
  }
  const checkout=await readFile(resolve(output,'sufler/buy/index.html'),'utf8');
  assert.match(checkout,/var API = '\/sufler\/api'/);
  assert.doesNotMatch(checkout,/hub\.146-103|LinkedIn/);
  const auth=await readFile(resolve(output,'vpn/cabinet/auth/index.html'),'utf8');
  assert.doesNotMatch(auth,/href="https:\/\/family-pie\.ru/);
  assert.match(auth,/Ключ входа со старого сайта привязан к прежнему домену/);
  const dictionary=await readFile(resolve(output,'i18n/en.js'),'utf8');
  assert.match(dictionary,/Sign in here with your username and password or verified email/);
  assert.match(home,/Демо-аккаунт/);
  assert.match(home,/Подготовленный пример собеседования/);
  assert.doesNotMatch(home,/100%|полная анонимность|вернём деньги|uptime|24\/7/i);
});
test('artifact rebuild refuses to erase unmanaged files or the portfolio source',async t=>{
  const directory=await mkdtemp(resolve('customer-site/dist-test-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const {writeFile}=await import('node:fs/promises');await writeFile(resolve(directory,'owner.txt'),'Keep this file');
  await assert.rejects(buildCustomerSite(directory),/unmanaged/);
  assert.equal(await readFile(resolve(directory,'owner.txt'),'utf8'),'Keep this file');
  await assert.rejects(buildCustomerSite(resolve('site')),/unsafe/);
});
test('customer-flow aliases retain only intended account/payment URL boundaries',()=>{
  for(const path of ['/vpn/cabinet','/vpn/cabinet/auth/','/vpn/admin/','/sufler/buy/','/sufler/buy/done/'])assert.equal(canonicalCustomerFlow(path),false,path);
  for(const path of ['/vpn/','/vpn/cabinet-evil','/sufler/buyer','/sufler/setup/','/vpn/api/login'])assert.equal(canonicalCustomerFlow(path),false,path);
});
test('plan proxies are a fixed public read-only allowlist',()=>{
  assert.deepEqual(Object.keys(publicPlans),['/public-plans/vpn','/public-plans/sufler']);
  assert.equal(publicPlans['/public-plans/vpn'],'https://family-spy.ru/vpn/api/plans');
  assert.equal(publicPlans['/public-plans/sufler'],'https://family-spy.ru/sufler/api/billing/plan');
});

// Canonical downloads stay on the product domain; bytes are served from the
// dedicated versioned native release root, outside generated artifact cleanup.
test('customer download links use only the native release host path',async()=>{
 for(const route of ['site/sufler/index.html','site/sufler/setup/index.html']){
  const html=await readFile(route,'utf8');
  assert.doesNotMatch(html,/github\.com\/SpiritusMalus\/family-pie\/releases\/download/);
  for(const name of ['Sufler-Setup-0.2.0-x64.exe','Sufler-0.2.0-arm64.dmg','Sufler-0.2.0-x64.dmg','SHA256SUMS.txt'])assert.ok(html.includes('/sufler/download/'+name));
 }
});

test('product evidence ships real image bytes without portal or private fixture data',async t=>{
  const directory=await mkdtemp(resolve('customer-site/dist-test-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const {output}=await buildCustomerSite(directory);
  for(const route of ['index.html','vpn/index.html','sufler/index.html']) {
    const html=await readFile(resolve(output,route),'utf8');
    assert.doesNotMatch(html,/<canvas|src="[^"]*portal\.js|class="prompt-example"|class="preview-answer"/);
    assert.doesNotMatch(html,/PreviewPassword|DEMO_NOT_A_REAL_KEY|localhost:816|user-fixture/);
    for(const match of html.matchAll(/(?:src|data-src)="(\/media\/[^"]+)"/g)) {
      const bytes=await readFile(resolve(output,'.'+match[1]));
      assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff',match[1]);
      assert.ok(bytes.length>10000,match[1]);
    }
  }
  const home=await readFile(resolve(output,'index.html'),'utf8');
  assert.equal((home.match(/class="demo-play"/g)||[]).length,2);
  assert.equal((home.match(/data-frame="/g)||[]).length,6);
  assert.match(home,/После оплаты/);
});

// Exercise user control and failure recovery without a real account, API or clock.
async function demoHarness({reduced=false,broken=false}={}) {
  const {runInNewContext}=await import('node:vm');
  const node=(dataset={})=>({dataset,hidden:false,complete:true,naturalWidth:760,attrs:{},listeners:{},textContent:'',
    setAttribute(key,value){this.attrs[key]=value;},getAttribute(key){return this.attrs[key]||'';},
    addEventListener(event,fn){this.listeners[event]=fn;}});
  const image=node({copyAttr:'alt'});image.naturalWidth=broken?0:760;
  const link=node({copyAttr:'aria-label'}),full=node(),caption=node(),play=node(),failure=node(),controls=node();
  const frames=[0,1,2].map(i=>node({src:`/media/frame-${i}.jpg`,altRu:`Экран ${i}`,altEn:`Screen ${i}`,captionRu:`Шаг ${i}`,captionEn:`Step ${i}`}));
  const elements={'.demo-screen':image,'.screen-link':link,'.original-link':full,'.demo-description':caption,'.demo-play':play,'.screen-error':failure,'.demo-controls':controls};
  const root={dataset:{initial:'2'},querySelector:key=>elements[key],querySelectorAll:()=>frames};
  const media={matches:reduced,addEventListener(event,fn){this.change=fn;}};
  const timers=new Map();let timerId=0;
  const document={hidden:false,listeners:{},documentElement:{classList:{add(){}}},
    querySelectorAll(selector){return selector==='[data-demo]'?[root]:selector==='[data-ru][data-en]'?[image,link,caption,play]:[];},
    getElementById(){return null;},addEventListener(event,fn){this.listeners[event]=fn;}};
  const events={};
  const context={document,matchMedia:()=>media,window:{FPi18n:{lang:'ru'}},
    setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
    addEventListener:(event,fn)=>events[event]=fn,location:{origin:'https://example.test'},URL,WeakMap};
  runInNewContext(await readFile('customer-site/customer.js','utf8'),context);
  return {image,link,full,caption,play,failure,frames,document,media,timers,context,events,
    tick(){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}};
}
test('demo stays still initially, runs once after click and manual selection pauses it',async()=>{
  const h=await demoHarness();assert.equal(h.timers.size,0);
  h.play.listeners.click();assert.equal(h.image.src,'/media/frame-0.jpg');assert.equal(h.play.attrs['aria-pressed'],'true');
  h.tick();assert.equal(h.image.src,'/media/frame-1.jpg');
  h.tick();assert.equal(h.image.src,'/media/frame-2.jpg');h.tick();assert.equal(h.timers.size,0);assert.equal(h.play.attrs['aria-pressed'],'false');
  h.play.listeners.click();h.frames[1].listeners.click();assert.equal(h.timers.size,0);assert.equal(h.full.href,'/media/frame-1.jpg');
  h.context.window.FPi18n.lang='en';h.events['fp-languagechange']();assert.equal(h.image.attrs.alt,'Screen 1');assert.equal(h.caption.textContent,'Step 1');assert.equal(h.full.href,h.link.href);
});
test('reduced motion advances manually; hidden tab and failed images stop playback',async()=>{
  const h=await demoHarness({reduced:true});h.play.listeners.click();assert.equal(h.timers.size,0);assert.equal(h.image.src,'/media/frame-0.jpg');
  h.media.matches=false;h.media.change();h.play.listeners.click();h.document.hidden=true;h.document.listeners.visibilitychange();assert.equal(h.timers.size,0);
  h.play.listeners.click();h.image.listeners.error();assert.equal(h.timers.size,0);assert.equal(h.failure.hidden,false);assert.equal(h.image.hidden,true);
  h.frames[1].listeners.click();h.image.listeners.load();assert.equal(h.image.hidden,false);assert.equal(h.failure.hidden,true);
  const cached=await demoHarness({broken:true});assert.equal(cached.failure.hidden,false);assert.equal(cached.image.hidden,true);
});
