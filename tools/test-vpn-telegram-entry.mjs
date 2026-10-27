import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../site/vpn/telegram-entry.js',import.meta.url),'utf8');
const token='a'.repeat(43);
function fixture({purpose='import',fragment='token='+token+'&device=ios',search='?lang=en',profileUrl='https://example.invalid/sub/fixture',responseDevice,ok=true,status=400,confirmFailure=false,networkFailure=false,deferPreview=false,clipboard=true}={}){
  const element=()=>({hidden:false,dataset:{},children:[],attributes:new Map(),events:new Map(),append(...children){this.children.push(...children);},setAttribute(key,value){this.attributes.set(key,value);},removeAttribute(key){this.attributes.delete(key);},addEventListener(event,fn){this.events.set(event,fn);},focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;}});
  const confirmEvents=new Map(),confirm={addEventListener:(event,fn)=>confirmEvents.set(event,fn)},cancel={},identity={},confirmation={hidden:true,querySelector:selector=>selector==='[data-telegram-account]'?identity:selector==='[data-telegram-cancel]'?cancel:confirm},login={hidden:false},title={hidden:false},methods={hidden:false},authRecovery={hidden:true},demo={hidden:false};
  const events=new Map(),message={dataset:{}},input={focus(){this.focused=true;},select(){this.selected=true;}},add=element(),copy={addEventListener:(event,fn)=>events.set(event,fn)};
  const installed=element(),added=element(),backInstall=element(),backAdd=element(),downloads=element(),deviceLabel=element(),stepLabel=element(),recovery={hidden:true};
  const steps=['install','import','enable'].map(name=>{const heading=element(),section=element();section.dataset.importStep=name;section.querySelector=()=>heading;return section;});
  const progress=steps.map(section=>{const item=element();item.dataset.importProgress=section.dataset.importStep;return item;});
  const fields={'textarea':input,'[data-import-add]':add,'[data-import-copy]':copy,'[data-import-installed]':installed,'[data-import-added]':added,'[data-import-back-install]':backInstall,'[data-import-back-add]':backAdd,'[data-import-downloads]':downloads,'[data-import-device]':deviceLabel,'[data-import-step-label]':stepLabel};
  const box={hidden:true,querySelector:selector=>fields[selector],querySelectorAll:selector=>selector==='[data-import-step]'?steps:selector==='[data-import-progress]'?progress:[]},calls=[],scrubbed=[];
  const location=new URL('https://family-spy.ru/vpn/'+(purpose==='import'?'connect/':'cabinet/auth/')+search+'#'+fragment);
  const window={FPi18n:{lang:'en',t:value=>value},events:new Map(),dispatched:[],addEventListener(event,fn){this.events.set(event,fn);},dispatchEvent(event){this.dispatched.push(event);this.events.get(event.type)?.(event);}};
  const history={replaceState:(_a,_b,path)=>{scrubbed.push(path);location.href=new URL(path,location).href;}};
  let destination,finishPreview;
  location.replace=path=>destination=path;
  runInNewContext(source,{window,document:{documentElement:{dataset:{telegramEntry:purpose}},createElement:element,querySelector:selector=>selector==='#telegram-import'?box:selector==='#telegram-entry-recovery'?recovery:selector==='#telegram-login-confirm'?confirmation:selector==='#login-form'?login:selector==='#auth-title'?title:selector==='.auth-methods'?methods:selector==='#password-recovery'?authRecovery:selector==='.demo-label'?demo:message},location,history,URL,URLSearchParams,AbortSignal,CustomEvent:class{constructor(type){this.type=type;}},navigator:{clipboard:{writeText:async value=>{if(!clipboard)throw Error('blocked');calls.push({copied:value});}}},fetch:async(path,options)=>{calls.push({path,options,hashAtRequest:location.hash});if(networkFailure)throw new TypeError('Synthetic network failure');if(deferPreview&&path.endsWith('/preview'))await new Promise(resolve=>finishPreview=resolve);return {ok:ok&&!(confirmFailure&&path.endsWith('/login')),status,json:async()=>({profileUrl,device:responseDevice,login:'telegram-fixture'})};}});
  return {window,location,calls,scrubbed,message,input,add,box,events,confirmEvents,confirmation,identity,cancel,login,title,methods,authRecovery,installed,added,backInstall,backAdd,downloads,deviceLabel,stepLabel,steps,progress,recovery,finishPreview:()=>finishPreview(),get destination(){return destination;}};
}
test('one-use import credential is removed before the same-origin no-store request, then kept out of the page URL',async()=>{
  const f=fixture();assert.equal(await f.window.vpnTelegramEntry,true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].hashAtRequest,'');assert.equal(f.calls[0].path,'/vpn/api/telegram/import');assert.equal(f.calls[0].options.cache,'no-store');assert.equal(f.calls[0].options.referrerPolicy,'no-referrer');assert.equal(JSON.parse(f.calls[0].options.body).token,token);assert.equal(f.location.hash,'');assert.equal(f.box.hidden,false);assert.equal(f.input.value,'https://example.invalid/sub/fixture');assert.match(f.add.href,/^happ:\/\/add\/https:/);
});
test('invalid credentials never issue a request or expose an import action',async()=>{
  const f=fixture({fragment:'token=bad&device=ios'});assert.equal(await f.window.vpnTelegramEntry,false);assert.equal(f.calls.length,0);assert.equal(f.box.hidden,true);assert.match(f.message.textContent,/Ссылка устарела/);assert.equal(f.recovery.hidden,false);
});
test('unsafe subscription schemes are rejected even if the API claims success',async()=>{
  const f=fixture({profileUrl:'javascript:alert(1)'});assert.equal(await f.window.vpnTelegramEntry,false);assert.equal(f.box.hidden,true);assert.equal(f.add.href,undefined);
});
test('denied clipboard keeps the actual manual link selected without false copied feedback',async()=>{
  const f=fixture({clipboard:false});await f.window.vpnTelegramEntry;await f.events.get('click')();assert.equal(f.input.focused,true);assert.equal(f.input.selected,true);assert.match(f.message.textContent,/вручную/);assert.equal(f.calls.filter(x=>x.copied).length,0);
});
test('login handoff previews identity without issuing login, then confirms with bounded device and language',async()=>{
  const f=fixture({purpose:'login',fragment:'telegram='+token+'&device='+encodeURIComponent('//evil.example')});assert.equal(await f.window.vpnTelegramEntry,true);assert.equal(f.calls[0].path,'/vpn/api/telegram/login/preview');assert.equal(f.calls[0].hashAtRequest,'');assert.equal(f.destination,undefined);assert.match(f.identity.textContent,/telegram-fixture/);assert.equal(f.confirmation.hidden,false);await f.confirmEvents.get('click')();assert.equal(f.calls[1].path,'/vpn/api/telegram/login');assert.equal(f.destination,'/vpn/cabinet/?lang=en#devices?platform=android');
});
test('failed or reused handoffs never redirect and never keep the credential in history',async()=>{
  const f=fixture({purpose:'login',fragment:'telegram='+token,ok:false});assert.equal(await f.window.vpnTelegramEntry,false);assert.equal(f.destination,undefined);assert.equal(f.location.hash,'');assert.match(f.message.textContent,/Ссылка устарела/);
});

test('import guides install, explicit subscription acknowledgement and enabling without treating an app launch as connection proof',async()=>{
 const f=fixture();await f.window.vpnTelegramEntry;
 assert.match(f.stepLabel.textContent,/Шаг 1 из 3/);assert.match(f.deviceLabel.textContent,/iPhone и iPad/);assert.equal(f.steps[0].hidden,false);assert.equal(f.steps[1].hidden,true);
 assert.equal(f.downloads.children[0].href,'https://apps.apple.com/us/app/happ-proxy-utility/id6504287215');assert.equal(f.downloads.children[0].target,'_blank');assert.equal(f.downloads.children[0].referrerPolicy,'no-referrer');assert.ok(!f.downloads.children[0].href.includes(token));
 assert.equal(f.input.value,'https://example.invalid/sub/fixture'); // Manual link remains present from the first step.
 f.installed.events.get('click')();assert.match(f.stepLabel.textContent,/Шаг 2 из 3/);assert.equal(f.steps[1].hidden,false);assert.equal(f.steps[0].hidden,true);
 f.add.events.get('click')();assert.match(f.stepLabel.textContent,/Шаг 2 из 3/);assert.match(f.message.textContent,/Если подписка появилась/);assert.doesNotMatch(f.message.textContent,/VPN подключён|VPN подключен/);
 f.added.events.get('click')();assert.match(f.stepLabel.textContent,/Шаг 3 из 3/);assert.equal(f.steps[2].hidden,false);assert.equal(f.progress[2].attributes.get('aria-current'),'step');
 assert.equal(f.calls.filter(call=>call.path).length,1);assert.equal(f.input.value,'https://example.invalid/sub/fixture');
 f.backAdd.events.get('click')();assert.match(f.stepLabel.textContent,/Шаг 2 из 3/);f.backInstall.events.get('click')();assert.match(f.stepLabel.textContent,/Шаг 1 из 3/);
});

test('server-scoped device chooses official installer; malformed device names fall back without external input becoming a URL',async()=>{
 const scoped=fixture({responseDevice:'android'});await scoped.window.vpnTelegramEntry;assert.match(scoped.deviceLabel.textContent,/Android/);assert.ok(scoped.downloads.children.some(link=>link.href==='https://play.google.com/store/apps/details?id=com.happproxy'));
 const invalid=fixture({fragment:'token='+token+'&device='+encodeURIComponent('//evil.example'),responseDevice:'javascript:bad'});await invalid.window.vpnTelegramEntry;assert.match(invalid.deviceLabel.textContent,/Android/);assert.ok(invalid.downloads.children.every(link=>!link.href.includes('evil.example')&&!link.href.includes('javascript:')));
});

test('consumed import credentials show the explicit bot recovery path while keeping private data and import controls unavailable',async()=>{
 const f=fixture({ok:false});assert.equal(await f.window.vpnTelegramEntry,false);assert.equal(f.recovery.hidden,false);assert.equal(f.box.hidden,true);assert.equal(f.input.value,undefined);assert.equal(f.add.href,undefined);assert.equal(f.location.hash,'');
 const html=readFileSync(new URL('../site/vpn/connect/index.html',import.meta.url),'utf8');assert.match(html,/Получить новую ссылку в Telegram/);assert.match(html,/В боте нажми «Подключиться»/);assert.ok(!html.includes('Войти в кабинет'));
});

test('expired, conflicting and unavailable login previews restore password recovery controls without changing the pending purchase destination',async()=>{
 const next='/vpn/cabinet/?lang=ru#plans?period=180',search='?lang=ru&period=180&next='+encodeURIComponent(next);
 for(const failure of [{ok:false},{ok:false,status:409},{networkFailure:true}]){
  const f=fixture({purpose:'login',fragment:'telegram='+token+'&device=ios',search,...failure});assert.equal(await f.window.vpnTelegramEntry,false);
  assert.equal(f.confirmation.hidden,true);assert.equal(f.login.hidden,false);assert.equal(f.title.hidden,false);assert.equal(f.methods.hidden,false);assert.ok(f.window.dispatched.some(event=>event.type==='vpn-auth-login-view'));
  const cancel=new URL(f.cancel.href,f.location);assert.equal(cancel.pathname,'/vpn/cabinet/auth/');assert.equal(cancel.searchParams.get('lang'),'ru');assert.equal(cancel.searchParams.get('period'),'180');assert.equal(cancel.searchParams.get('next'),next);assert.equal(cancel.searchParams.get('mode'),'login');assert.equal(cancel.searchParams.get('reauth'),'1');assert.equal(cancel.hash,'');
  assert.equal(f.location.searchParams.get('next'),next);assert.equal(f.location.hash,'');assert.equal(f.destination,undefined);assert.equal(f.calls.length,1);assert.ok(!f.calls.some(call=>call.path==='/vpn/api/telegram/login'));
 }
});

test('malformed login fragment keeps normal login visible and cannot strand a selected tariff in registration mode',async()=>{
 const f=fixture({purpose:'login',fragment:'telegram=bad',search:'?lang=en&period=90&mode=register'});assert.equal(await f.window.vpnTelegramEntry,false);
 assert.equal(f.login.hidden,false);assert.equal(f.methods.hidden,false);assert.equal(f.confirmation.hidden,true);assert.equal(f.location.searchParams.get('mode'),'login');assert.equal(f.location.searchParams.get('period'),'90');assert.equal(f.calls.length,0);
});

test('failed final confirmation preserves the explicit account-switch proof step and exposes a safe alternative-login URL',async()=>{
 const next='/vpn/cabinet/#devices?platform=ios',f=fixture({purpose:'login',fragment:'telegram='+token,search:'?lang=en&next='+encodeURIComponent(next),confirmFailure:true,status:409});
 assert.equal(await f.window.vpnTelegramEntry,true);await f.confirmEvents.get('click')();assert.equal(f.destination,undefined);assert.equal(f.confirmation.hidden,false);assert.match(f.message.textContent,/другой аккаунт/);
 const cancel=new URL(f.cancel.href,f.location);assert.equal(cancel.searchParams.get('next'),next);assert.equal(cancel.searchParams.get('lang'),'en');assert.equal(cancel.pathname,'/vpn/cabinet/auth/');assert.equal(cancel.hash,'');
});

test('a late failed preview does not close a password-reset form that the customer has already opened',async()=>{
 const f=fixture({purpose:'login',fragment:'telegram='+token,ok:false,deferPreview:true});f.authRecovery.hidden=false;f.finishPreview();assert.equal(await f.window.vpnTelegramEntry,false);
 assert.equal(f.authRecovery.hidden,false);assert.equal(f.login.hidden,true);assert.equal(f.methods.hidden,true);assert.equal(f.confirmation.hidden,true);assert.equal(f.window.dispatched.length,0);
});
