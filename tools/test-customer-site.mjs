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
  for(const route of ['vpn/index.html','vpn/cabinet/index.html','vpn/cabinet/auth/index.html','vpn/terms/index.html','vpn/privacy/index.html']) {
    const html=await readFile(resolve(output,route),'utf8');
    assert.match(html,/<nav class="customer-home"[\s\S]*?<a href="\/">/,route);
    assert.match(html,/data-en="All Family Spy products"/,route);
  }
  const checkout=await readFile(resolve(output,'sufler/buy/index.html'),'utf8');
  assert.match(checkout,/var API = '\/sufler\/api'/);
  assert.doesNotMatch(checkout,/hub\.146-103|LinkedIn/);
  const auth=await readFile(resolve(output,'vpn/cabinet/auth/index.html'),'utf8');
  assert.doesNotMatch(auth,/href="https:\/\/family-pie\.ru/);
  assert.match(auth,/Ключ входа со старого сайта привязан к прежнему домену/);
  const dictionary=await readFile(resolve(output,'i18n/en.js'),'utf8');
  assert.match(dictionary,/Sign in here with your username and password or verified email/);
  assert.doesNotMatch(home,/Демо-аккаунт/);
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
  assert.doesNotMatch(home,/demo-play|Короткое демо|После оплаты|Выбираешь подписку|Экраны кабинета|Account screens/);
  assert.equal((home.match(/data-frame="/g)||[]).length,2);
  const vpn=home.match(/<section id="vpn"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(vpn,/href="\/vpn\/(terms|privacy)\//);
  const footer=home.match(/<footer[\s\S]*?<\/footer>/)[0];
  assert.match(footer,/href="mailto:support@family-pie\.ru"/);
  assert.equal((footer.match(/<a /g)||[]).length,1);
  assert.doesNotMatch(footer,/Условия|Данные|Deepgram|©|class="brand"/);
  const suflerSection=home.match(/<section id="sufler"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(suflerSection,/Скачай приложение|href="\/sufler\/(terms|privacy)\//);
  assert.doesNotMatch(home,/опорные мысли|Опорные мысли/);
  assert.doesNotMatch(home,/<a class="screen-(link|view)"/);
  assert.match(home,/Показать вопрос/);assert.match(home,/Показать подсказку/);
});

// Test manual selection and recovery without accounts, APIs or a running clock.
async function demoHarness({broken=false}={}) {
  const {runInNewContext}=await import('node:vm');
  const node=(dataset={})=>({dataset,hidden:false,complete:true,naturalWidth:760,attrs:{},listeners:{},textContent:'',
    setAttribute(key,value){this.attrs[key]=value;},getAttribute(key){return this.attrs[key]||'';},
    addEventListener(event,fn){this.listeners[event]=fn;}});
  const image=node({copyAttr:'alt'});image.naturalWidth=broken?0:760;image.src='/media/frame-0.jpg';
  const full=node(),caption=node(),failure=node(),controls=node();full.href=image.src;
  const frames=[0,1].map(i=>node({src:`/media/frame-${i}.jpg`,altRu:`Экран ${i}`,altEn:`Screen ${i}`,captionRu:`Шаг ${i}`,captionEn:`Step ${i}`}));
  const elements={'.demo-screen':image,'.original-link':full,'.demo-description':caption,'.screen-error':failure,'.demo-controls':controls};
  const root={querySelector:key=>elements[key],querySelectorAll:()=>frames};
  const document={documentElement:{classList:{add(){}}},
    querySelectorAll(selector){return selector==='[data-demo]'?[root]:selector==='[data-ru][data-en]'?[image,caption]:[];},getElementById(){return null;},querySelector(){return null;}};
  const events={};let scheduled=0;
  const context={document,window:{FPi18n:{lang:'ru'}},setTimeout(){scheduled++;},setInterval(){scheduled++;},
    addEventListener:(event,fn)=>events[event]=fn,location:{origin:'https://example.test'},URL,WeakMap};
  runInNewContext(await readFile('customer-site/customer.js','utf8'),context);
  return {image,full,caption,failure,frames,context,events,get scheduled(){return scheduled;}};
}
test('manual example changes only after selection and preserves the original link across language changes',async()=>{
  const h=await demoHarness();assert.equal(h.scheduled,0);assert.equal(h.image.src,'/media/frame-0.jpg');
  h.frames[1].listeners.click();assert.equal(h.image.src,'/media/frame-1.jpg');assert.equal(h.full.href,h.image.src);
  assert.equal(h.frames[1].attrs['aria-pressed'],'true');assert.equal(h.frames[0].attrs['aria-pressed'],'false');
  h.context.window.FPi18n.lang='en';h.events['fp-languagechange']();assert.equal(h.image.attrs.alt,'Screen 1');assert.equal(h.caption.textContent,'Step 1');assert.equal(h.full.href,'/media/frame-1.jpg');
  h.frames[0].listeners.click();assert.equal(h.image.alt,'Screen 0');assert.equal(h.scheduled,0);
});
test('failed images offer recovery and manual selection can recover even from a cached failure',async()=>{
  const h=await demoHarness({broken:true});assert.equal(h.failure.hidden,false);assert.equal(h.image.hidden,true);
  h.frames[1].listeners.click();h.image.listeners.load();assert.equal(h.image.hidden,false);assert.equal(h.failure.hidden,true);
  h.image.listeners.error();assert.equal(h.image.hidden,true);assert.equal(h.failure.hidden,false);assert.equal(h.scheduled,0);
});

// USD is an estimate only; unavailable/test/malformed plans must not become offers.
test('pricing uses validated public RUB plans and the disclosed USD reference rate',async()=>{
 const {runInNewContext}=await import('node:vm');
 const run=async data=>{
  const price={textContent:'fallback'};
  const cards=[30,90,180,365].map(days=>{
   const amount={textContent:'fallback'},usd={hidden:true,textContent:''};
   return {dataset:{vpnPlan:String(days)},classList:{add(){}},amount,usd,querySelector:key=>key==='.vpn-plan-amount'?amount:usd};
  });
  const events={};const context={document:{documentElement:{classList:{add(){}}},
   getElementById:id=>id==='vpn-price'?price:null,querySelector:()=>({dataset:{usdRub:'83.6177'}}),
   querySelectorAll:selector=>selector==='[data-vpn-plan]'?cards:[]},
   window:{FPi18n:{lang:'ru'}},addEventListener:(e,fn)=>events[e]=fn,
   location:{origin:'https://example.test'},URL,WeakMap,
   fetch:async()=>({ok:true,json:async()=>data})};
  runInNewContext(await readFile('customer-site/customer.js','utf8'),context);
  for(let i=0;i<8;i++)await Promise.resolve();
  return {price,cards,context,events};
 };
 const valid={available:true,testMode:false,plans:[{days:30,priceMinor:30000},{days:90,priceMinor:-1},{days:180,priceMinor:'140000'},{days:365,priceMinor:250000}]};
 const h=await run(valid);
 assert.equal(h.price.textContent,'300 ₽ за 30 дней');
 assert.equal(h.cards[0].usd.textContent,'≈ US$3.59');assert.equal(h.cards[3].usd.textContent,'≈ US$29.90');
 assert.equal(h.cards[1].usd.hidden,true);assert.equal(h.cards[2].amount.textContent,'fallback');
 h.context.window.FPi18n.lang='en';h.events['fp-languagechange']();assert.equal(h.price.textContent,'300 RUB for 30 days');assert.equal(h.cards[0].amount.textContent,'300 RUB');
 for(const data of [{...valid,available:false},{...valid,testMode:true},{...valid,plans:null},{...valid,plans:[{days:30,priceMinor:0}]}]){
  const bad=await run(data);assert.equal(bad.price.textContent,'fallback');assert.ok(bad.cards.every(c=>c.usd.hidden));
 }
});
