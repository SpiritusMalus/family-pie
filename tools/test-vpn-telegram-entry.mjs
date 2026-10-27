import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../site/vpn/telegram-entry.js',import.meta.url),'utf8');
const token='a'.repeat(43);
function fixture({purpose='import',fragment='token='+token+'&device=ios',profileUrl='https://example.invalid/sub/fixture',ok=true,clipboard=true}={}){
  const confirmEvents=new Map(),confirm={addEventListener:(event,fn)=>confirmEvents.set(event,fn)},identity={},confirmation={hidden:true,querySelector:selector=>selector==='[data-telegram-account]'?identity:confirm},login={},title={},methods={};
  const events=new Map(),message={dataset:{}},input={focus(){this.focused=true;},select(){this.selected=true;}},add={},copy={addEventListener:(event,fn)=>events.set(event,fn)},box={hidden:true,querySelector:selector=>selector==='textarea'?input:selector==='[data-import-add]'?add:copy},calls=[],scrubbed=[];
  const location=new URL('https://family-spy.ru/vpn/'+(purpose==='import'?'connect/':'cabinet/auth/')+'?lang=en#'+fragment);
  const window={FPi18n:{lang:'en',t:value=>value}};
  const history={replaceState:(_a,_b,path)=>{scrubbed.push(path);location.href=new URL(path,location).href;}};
  let destination;
  location.replace=path=>destination=path;
  runInNewContext(source,{window,document:{documentElement:{dataset:{telegramEntry:purpose}},querySelector:selector=>selector==='#telegram-import'?box:selector==='#telegram-login-confirm'?confirmation:selector==='#login-form'?login:selector==='#auth-title'?title:selector==='.auth-methods'?methods:message},location,history,URL,URLSearchParams,AbortSignal,navigator:{clipboard:{writeText:async value=>{if(!clipboard)throw Error('blocked');calls.push({copied:value});}}},fetch:async(path,options)=>{calls.push({path,options,hashAtRequest:location.hash});return {ok,json:async()=>({profileUrl,login:'telegram-fixture'})};}});
  return {window,location,calls,scrubbed,message,input,add,box,events,confirmEvents,confirmation,identity,get destination(){return destination;}};
}
test('one-use import credential is removed before the same-origin no-store request, then kept out of the page URL',async()=>{
  const f=fixture();assert.equal(await f.window.vpnTelegramEntry,true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].hashAtRequest,'');assert.equal(f.calls[0].path,'/vpn/api/telegram/import');assert.equal(f.calls[0].options.cache,'no-store');assert.equal(f.calls[0].options.referrerPolicy,'no-referrer');assert.equal(JSON.parse(f.calls[0].options.body).token,token);assert.equal(f.location.hash,'');assert.equal(f.box.hidden,false);assert.equal(f.input.value,'https://example.invalid/sub/fixture');assert.match(f.add.href,/^happ:\/\/add\/https:/);
});
test('invalid credentials never issue a request or expose an import action',async()=>{
  const f=fixture({fragment:'token=bad&device=ios'});assert.equal(await f.window.vpnTelegramEntry,false);assert.equal(f.calls.length,0);assert.equal(f.box.hidden,true);assert.match(f.message.textContent,/Ссылка устарела/);
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
