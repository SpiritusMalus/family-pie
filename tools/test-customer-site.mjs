import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildCustomerSite,canonicalCustomerFlow,publicPlans} from './build-customer-site.mjs';

test('standalone customer artifact includes account/payment pages without portfolio',async t=>{
  const directory=await mkdtemp(resolve('customer-site/dist-test-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const {output}=await buildCustomerSite(directory);
  for(const path of ['index.html','vpn/terms/index.html','sufler/index.html','sufler/setup/index.html','sufler/privacy/index.html','i18n/language.js','vpn/fonts.css','vpn/cabinet/index.html','vpn/cabinet/auth/index.html','vpn/admin/index.html','sufler/buy/index.html','sufler/buy/done/index.html'])await access(resolve(output,path));
  await access(resolve(output,'vpn/index.html'));
  for(const path of ['work','preview','rest_lumen','driftora'])await assert.rejects(access(resolve(output,path)));
  const home=await readFile(resolve(output,'index.html'),'utf8');
  const sitemap=await readFile(resolve(output,'sitemap.xml'),'utf8');
  assert.match(sitemap,/<loc>https:\/\/family-spy\.ru\/vpn\/<\/loc>/);
  assert.match(sitemap,/<loc>https:\/\/family-spy\.ru\/vpn\/terms\/<\/loc>/);
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
  for(const route of ['vpn/cabinet/index.html','vpn/cabinet/auth/index.html','vpn/terms/index.html','vpn/privacy/index.html']) {
    const html=await readFile(resolve(output,route),'utf8');
    assert.match(html,/<nav class="customer-home"[\s\S]*?<a href="\/">/,route);
    assert.match(html,/data-en="All Family Spy products"/,route);
  }
  const checkout=await readFile(resolve(output,'sufler/buy/index.html'),'utf8');
  assert.match(checkout,/var API = '\/sufler\/api'/);
  assert.doesNotMatch(checkout,/hub\.146-103|LinkedIn/);
  const auth=await readFile(resolve(output,'vpn/cabinet/auth/index.html'),'utf8');
  assert.doesNotMatch(auth,/href="https:\/\/family-pie\.ru/);
  assert.doesNotMatch(auth,/Ключ входа со старого сайта привязан к прежнему домену/);
  const dictionary=await readFile(resolve(output,'i18n/en.js'),'utf8');
  assert.doesNotMatch(dictionary,/Passkeys from the previous site are tied to that domain/);
  assert.doesNotMatch(home,/Демо-аккаунт/);
  assert.doesNotMatch(home,/Пример собеседования|demo-question|Для Windows и macOS\. Нужен свой ключ/);
  assert.doesNotMatch(home,/vpn-pricing-basis|vpn-currency-note|demo-provenance|support-note/);
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
  for(const route of ['index.html','sufler/index.html']) {
    const html=await readFile(resolve(output,route),'utf8');
    assert.doesNotMatch(html,/data-screen-link|href="\/screenshots\//);
    for(const anchor of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)) assert.doesNotMatch(anchor[0],/<img\b/,route);
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
  assert.equal((home.match(/data-frame="/g)||[]).length,0);
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
  assert.doesNotMatch(suflerSection,/<button|Как настроить|Показать вопрос|Показать подсказку|original-link/);
  assert.equal((suflerSection.match(/<a /g)||[]).length,1);
  assert.match(suflerSection,/href="\/sufler\/#download"/);
  assert.match(suflerSection,/src="\/media\/sufler-answer\.jpg"/);
  await assert.rejects(access(resolve(output,'screenshots')));
});

// Static evidence recovers from a failed image without adding another homepage action.
test('static Sufler image exposes an error and recovers on load, including cached failures',async()=>{
 const {runInNewContext}=await import('node:vm');
 for(const broken of [false,true]){
  const image={hidden:false,complete:true,naturalWidth:broken?0:760,listeners:{},addEventListener(e,fn){this.listeners[e]=fn;}};
  const failure={hidden:true};
  const root={querySelector:key=>key==='.demo-screen'?image:failure};
  const document={documentElement:{classList:{add(){}}},querySelectorAll:key=>key==='[data-static-screen]'?[root]:[],querySelector:()=>null,getElementById:()=>null};
  runInNewContext(await readFile('customer-site/customer.js','utf8'),{document,window:{FPi18n:{lang:'ru'}},addEventListener(){},URL,WeakMap});
  assert.equal(image.hidden,broken);assert.equal(failure.hidden,!broken);
  image.listeners.error();assert.equal(image.hidden,true);assert.equal(failure.hidden,false);
  image.listeners.load();assert.equal(image.hidden,false);assert.equal(failure.hidden,true);
 }
});

// USD is an estimate only; unavailable/test/malformed plans must not become offers.
test('pricing uses validated public RUB plans and the USD reference rate',async()=>{
 const {runInNewContext}=await import('node:vm');
 const run=async data=>{
  const price={textContent:'fallback'};
  const cards=[30,90,180,365].map(days=>{
   const node=()=>({hidden:true,textContent:'',dataset:{}});
   const amount={textContent:'fallback'},usd=node(),monthly=node(),unit=node(),saving=node(),best=node();
   const nodes={'.vpn-plan-amount':amount,'.vpn-plan-usd':usd,'.vpn-plan-monthly':monthly,'.vpn-plan-unit':unit,'.vpn-plan-saving':saving,'.vpn-plan-best':best};
   return {dataset:{vpnPlan:String(days)},classList:{add(){}},amount,usd,monthly,unit,saving,best,querySelector:key=>nodes[key]};
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
 const valid={available:true,testMode:false,plans:[{days:30,priceMinor:30000},{days:90,priceMinor:80000},{days:180,priceMinor:140000},{days:365,priceMinor:250000}]};
 const h=await run(valid);
 assert.equal(h.price.textContent,'300 ₽ за 30 дней');
 assert.equal(h.cards[0].usd.textContent,'≈ US$3.59');assert.equal(h.cards[3].usd.textContent,'≈ US$29.90');
 assert.equal(h.cards[0].saving.hidden,true);assert.equal(h.cards[0].monthly.textContent,'300 ₽');assert.equal(h.cards[1].monthly.textContent,'266,67 ₽');
 assert.equal(h.cards[2].saving.textContent,'Экономия 400 ₽');assert.equal(h.cards[3].monthly.textContent,'208,33 ₽');assert.equal(h.cards[3].saving.textContent,'Экономия 1\u00a0100 ₽');
 assert.equal(h.cards[3].best.hidden,false);assert.ok(h.cards.slice(0,3).every(c=>c.best.hidden));
 const changed=await run({...valid,plans:[{days:30,priceMinor:30000},{days:90,priceMinor:24000},{days:365,priceMinor:250000}]});
 assert.equal(changed.cards[1].best.hidden,false);assert.equal(changed.cards[3].best.hidden,true);
 const badAmounts=await run({...valid,plans:[valid.plans[0],{days:90,priceMinor:-1},{days:180,priceMinor:'140000'}]});
 assert.equal(badAmounts.cards[1].usd.hidden,true);assert.equal(badAmounts.cards[2].monthly.hidden,true);
 const missingBase=await run({...valid,plans:[valid.plans[1],valid.plans[3]]});assert.ok(missingBase.cards.every(c=>c.saving.hidden));
 h.context.window.FPi18n.lang='en';h.events['fp-languagechange']();assert.equal(h.price.textContent,'300 RUB for 30 days');assert.equal(h.cards[0].amount.textContent,'Total 300 RUB');assert.equal(h.cards[3].saving.textContent,'Save 1,100 RUB');
 for(const data of [{...valid,available:false},{...valid,testMode:true},{...valid,plans:null},{...valid,plans:[{days:30,priceMinor:0}]}]){
  const bad=await run(data);assert.equal(bad.price.textContent,'fallback');assert.ok(bad.cards.every(c=>c.usd.hidden));
 }
});

// The mobile disclosure preserves the chosen duration across locale and viewport changes.
test('mobile offer disclosure keeps one choice and restores it after desktop or language changes',async()=>{
 const {runInNewContext}=await import('node:vm');
 const media={matches:false,addEventListener(type,fn){assert.equal(type,'change');this.change=fn;}};
 const offers=[30,90,180,365].map(days=>{
  const summary={tabIndex:0,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}};
  return {dataset:{vpnPlan:String(days)},open:true,attributes:{},listeners:{},summary,
   removeAttribute(name){delete this.attributes[name];},setAttribute(name,value){this.attributes[name]=value;},
   querySelector:selector=>selector==='summary'?summary:null,addEventListener(type,fn){this.listeners[type]=fn;}};
 });
 const events={};
 const context={document:{documentElement:{classList:{add(){}}},querySelectorAll:selector=>selector==='details[data-vpn-plan]'?offers:[],querySelector:()=>null,getElementById:()=>null},
  window:{FPi18n:{lang:'ru'},matchMedia:()=>media},addEventListener:(type,fn)=>events[type]=fn,URL,WeakMap};
 runInNewContext(await readFile('customer-site/customer.js','utf8'),context);
 assert.ok(offers.every(o=>o.open&&o.summary.tabIndex===-1&&!o.attributes.name));
 let prevented=false;offers[0].summary.listeners.click({preventDefault(){prevented=true;}});assert.ok(prevented);
 media.matches=true;media.change();assert.deepEqual(offers.map(o=>o.open),[true,false,false,false]);
 assert.ok(offers.every(o=>o.summary.tabIndex===0&&o.attributes.name==='vpn-offers'));
 offers[2].open=true;offers[2].listeners.toggle();assert.deepEqual(offers.map(o=>o.open),[false,false,true,false]);
 context.window.FPi18n.lang='en';events['fp-languagechange']();assert.deepEqual(offers.map(o=>o.open),[false,false,true,false]);
 media.matches=false;media.change();assert.ok(offers.every(o=>o.open&&!o.attributes.name));
 media.matches=true;media.change();assert.deepEqual(offers.map(o=>o.open),[false,false,true,false]);
});

test('device choice keeps the selected setup route through locale changes',async()=>{
 const {runInNewContext}=await import('node:vm');
 const choices=['windows','android','tv'].map(value=>({value,checked:value==='android',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}}));
 const setup={attributes:{href:'/vpn/cabinet/#devices?platform=windows'},getAttribute(name){return this.attributes[name];},setAttribute(name,value){this.attributes[name]=value;}};
 const name={textContent:'Windows'};
 const label={dataset:{ru:'Настроить',en:'Set up'},textContent:'Настроить'};
 const scene={dataset:{activeDevice:'windows'},querySelectorAll:selector=>selector==='input[name="hero-device"]'?choices:[],querySelector:selector=>selector==='[data-device-setup]'?setup:selector==='[data-device-name]'?name:null};
 const events={};
 const context={document:{documentElement:{classList:{add(){}}},getElementById:()=>null,querySelector:()=>null,
  querySelectorAll:selector=>selector==='[data-device-scene]'?[scene]:selector==='[data-ru][data-en]'?[label]:selector==='a[href]'?[setup]:[]},
  window:{FPi18n:{lang:'ru'}},addEventListener:(type,fn)=>events[type]=fn,location:{origin:'https://family-spy.ru'},URL,WeakMap};
 runInNewContext(await readFile('customer-site/customer.js','utf8'),context);
 // Read native checked state on enhancement rather than forcing the static default.
 assert.equal(scene.dataset.activeDevice,'android');assert.equal(name.textContent,'Android');
 assert.equal(setup.attributes.href,'/vpn/cabinet/?lang=ru#devices?platform=android');
 choices.forEach(choice=>choice.checked=choice.value==='tv');choices[2].listeners.change();
 assert.equal(scene.dataset.activeDevice,'tv');assert.equal(name.textContent,'Smart TV');
 assert.equal(setup.attributes.href,'/vpn/cabinet/?lang=ru#devices?platform=tv');
 context.window.FPi18n.lang='en';events['fp-languagechange']();
 assert.equal(label.textContent,'Set up');assert.equal(choices[2].checked,true);assert.equal(scene.dataset.activeDevice,'tv');
 assert.equal(name.textContent,'Smart TV');assert.equal(setup.attributes.href,'/vpn/cabinet/?lang=en#devices?platform=tv');
 choices.forEach(choice=>choice.checked=choice.value==='windows');choices[0].listeners.change();
 assert.equal(name.textContent,'Windows');assert.equal(setup.attributes.href,'/vpn/cabinet/?lang=en#devices?platform=windows');
 context.window.FPi18n.lang='ru';events['fp-languagechange']();
 assert.equal(label.textContent,'Настроить');assert.equal(setup.attributes.href,'/vpn/cabinet/?lang=ru#devices?platform=windows');
 assert.deepEqual(choices.map(choice=>choice.checked),[true,false,false]);
});

test('homepage keeps real offer actions, device fallback and no-JavaScript details',async()=>{
 const html=await readFile('customer-site/index.html','utf8');
 const hero=html.slice(html.indexOf('<section id="vpn"'),html.indexOf('<div id="vpn-features"'));
 assert.match(hero,/id="vpn-title"/);assert.match(hero,/href="#vpn-pricing"/);assert.match(hero,/href="\/vpn\/cabinet\/"/);
 assert.doesNotMatch(hero,/data-vpn-plan=|vpn-signal/);
 assert.match(hero,/data-device-scene[^>]*data-active-device="windows"/);
 assert.match(hero,/<input\b[^>]*name="hero-device"[^>]*value="windows"[^>]*checked/);
 assert.match(hero,/data-device-setup[^>]*href="\/vpn\/cabinet\/#devices\?platform=windows"|href="\/vpn\/cabinet\/#devices\?platform=windows"[^>]*data-device-setup/);
 for(const platform of ['windows','android','tv'])assert.match(hero,new RegExp('name="hero-device"[^>]*value="'+platform+'"'));
 assert.ok(html.indexOf('id="vpn-features"')<html.indexOf('id="vpn-pricing"'));
 assert.ok(html.indexOf('id="vpn-pricing"')<html.search(/class="[^"]*\bvpn-devices\b[^"]*"/));
 for(const days of [30,90,180,365])assert.match(html,new RegExp('<details class="vpn-plan" data-vpn-plan="'+days+'" open>'));
 assert.equal((html.match(/class="vpn-plan-summary"/g)||[]).length,4);
 for(const platform of ['android','ios','windows','macos','linux','tv'])assert.ok(html.includes('#devices?platform='+platform));
});

test('IndexNow ownership proof is supplied explicitly and excluded from page content and sitemap',async t=>{
 const directory=await mkdtemp(resolve('customer-site/dist-test-indexnow-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const fixture='test-indexnow-proof-1234567890';
 await buildCustomerSite(directory,{indexNowKey:fixture});
 assert.equal(await readFile(resolve(directory,fixture+'.txt'),'utf8'),fixture);
 for(const path of ['index.html','vpn/index.html','sitemap.xml','robots.txt'])assert.ok(!(await readFile(resolve(directory,path),'utf8')).includes(fixture),path);
 await buildCustomerSite(directory,{indexNowKey:''});
 await assert.rejects(access(resolve(directory,fixture+'.txt')));
 for(const invalid of ['../outside','short','a'.repeat(129),'proof/with/path'])await assert.rejects(buildCustomerSite(directory,{indexNowKey:invalid}),/Invalid IndexNow/);
 await access(resolve(directory,'index.html'));
});
