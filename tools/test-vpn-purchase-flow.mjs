import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../site/vpn/cabinet-ui.js',import.meta.url),'utf8'),returnCode=readFileSync(new URL('../site/vpn/payment-return.js',import.meta.url),'utf8');
const id='01234567-89ab-4cde-8fab-0123456789ab';
class Element{
 constructor(tag,text=''){this.tagName=tag.toUpperCase();this._text=String(text);this.children=[];this.dataset={};this.attributes={};this.events=new Map();this.classList={add:()=>{},remove:()=>{}};this.hidden=false;this.value='';}
 set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
 prepend(...nodes){for(const n of nodes)n.parentElement=this;this.children.unshift(...nodes);}
 replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
 setAttribute(name,value){this.attributes[name]=String(value);if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
 removeAttribute(name){delete this.attributes[name];if(name.startsWith('data-'))delete this.dataset[name.slice(5)];}
 addEventListener(name,fn){this.events.set(name,fn);}focus(){this.focused=true;}scrollIntoView(){}checkValidity(){return true;}reportValidity(){}
 all(){return this.children.flatMap(n=>[n,...n.all()]);}
 matches(selector){
  if(selector.startsWith('#'))return this.id===selector.slice(1);
  if(selector.startsWith('.'))return (this.className||'').split(' ').includes(selector.slice(1));
  const attr=selector.match(/^([a-z]+)?\[([a-z-]+)(?:="([^"]*)")?\]$/);if(attr){const[,tag,name,value]=attr;const actual=name.startsWith('data-')?this.dataset[name.slice(5)]:this[name]??this.attributes[name];return (!tag||this.tagName.toLowerCase()===tag)&&actual!==undefined&&(value===undefined||String(actual)===value);}
  return this.tagName.toLowerCase()===selector;
 }
 querySelectorAll(selector){const parts=selector.split(' ');return this.all().filter(n=>n.matches(parts.at(-1))&&(parts.length===1||n.parentElement?.matches(parts[0])));}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function fixture({url='https://family-spy.ru/vpn/cabinet/?lang=ru#plans?period=180',orders=[],subscription={active:false,payment_required:true,sync_state:'awaiting_payment'},storage=new Map(),account='fixture-account',resume,check,checkout,confirmNewOrder=false,receiptEmail='fixture@example.invalid'}={}){
 const root=new Element('main');root.id='main';const home=new Element('div');home.dataset.screen='home';const panel=new Element('section');panel.className='subscription';const connection=new Element('section');connection.className='cab-section';home.append(panel,connection);root.append(home);
 for(const screen of ['plans','devices','friends','support','news','settings','technical']){const el=new Element('div');el.dataset.screen=screen;const heading=new Element('div');heading.className='cab-head';heading.append(new Element('p'));el.append(heading);if(screen==='devices'){const notice=new Element('div');notice.className='notice';el.append(notice);}root.append(el);}
 const listeners=new Map(),calls=[],location=new URL(url),history={replaceState:(_a,_b,value)=>{location.href=new URL(value,location).href;}},window={FPi18n:{lang:new URL(url).searchParams.get('lang')||'ru',t:x=>x},addEventListener:(event,fn)=>{const list=listeners.get(event)||[];list.push(fn);listeners.set(event,list);},removeEventListener:()=>{},dispatchEvent:event=>listeners.get(event.type)?.forEach(fn=>fn(event)),vpnDevicePlatform:()=> 'macos'};
 const document={createElement:tag=>new Element(tag),createTextNode:text=>new Element('text',text),querySelector:selector=>selector==='#main'?root:root.querySelector(selector),body:{classList:{remove:()=>{}}}};
 let allOrders=orders,sub=subscription,checking=check;
 const api=async(path,method,body)=>{
  calls.push({path,method,body});
  if(path==='profile')return {profile:{receipt_email:receiptEmail,display_name:'Fixture',news:false}};
  if(path==='plans')return {available:true,plans:[{days:30,priceMinor:30000},{days:90,priceMinor:80000},{days:180,priceMinor:140000},{days:365,priceMinor:250000}]};
  if(path==='me')return {subscription:sub};if(path==='orders')return {orders:allOrders};
  if(path.endsWith('/resume'))return resume?await resume():{order:{id,state:'pending',days:180,price_minor:140000},url:'https://yoomoney.ru/checkout/fixture'};
  if(path.endsWith('/check'))return checking?await checking():{order:{id,state:'pending',days:180,price_minor:140000}};
  if(path==='checkout')return checkout?await checkout():{orderId:id,url:'https://yoomoney.ru/checkout/fixture'};
  if(path==='friends')return {url:'https://example.invalid/invite',registered:0,paid:0,rewardsEnabled:false};
  if(path==='support')return {threads:[]};if(path==='news')return {posts:[]};if(path==='passkeys')return {passkeys:[]};if(path==='google'||path==='email')return {available:false};if(path==='sessions')return {sessions:[]};if(path==='push')return {available:false,devices:[]};throw new Error('Unexpected '+path);
 };
 const confirms=[];const context={window,document,location,history,URLSearchParams,Intl,Event,AbortSignal,Uint8Array,confirm:text=>{confirms.push(text);return typeof confirmNewOrder==='function'?confirmNewOrder():confirmNewOrder;},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setInterval:()=>1,clearInterval:()=>{},crypto:{randomUUID:()=>id}};
 runInNewContext(returnCode,context);runInNewContext(code,context);
 const ready=listeners.get('vpn-ready')[0]({detail:{api,me:{user:{account_id:account},subscription:sub}}});
 return {root,window,location,storage,calls,confirms,ready,setOrders:value=>allOrders=value,setSubscription:value=>sub=value,query:selector=>root.querySelector(selector),buttons:label=>root.all().filter(n=>n.tagName==='BUTTON'&&n.textContent===label),click:async element=>element.events.get('click')(),dispatch:(type,detail)=>window.dispatchEvent({type,detail})};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('selected tariff survives device navigation, subscription navigation and a reload in the same account',async()=>{
 const f=fixture();await f.ready;assert.equal(f.query('[data-days="180"]').dataset.selected,'true');
 f.location.hash='devices';f.location.hash='plans';const reloaded=fixture({url:f.location.href,storage:f.storage});await reloaded.ready;assert.equal(reloaded.query('[data-days="180"]').dataset.selected,'true');assert.match(reloaded.query('[data-screen="plans"]').textContent,/180 дней · 1/);
});
test('pending payment shows the immutable order amount and resumes only that existing order',async()=>{
 const pending={id,state:'pending',days:180,price_minor:126000,created_at:Date.now()},f=fixture({orders:[pending]});await f.ready;
 assert.equal(f.buttons('Перейти к оплате')[0].hidden,true);assert.match(f.query('.pending-checkout').textContent,/180 дней · 1\s?260/);assert.equal(f.calls.some(c=>c.path==='checkout'),false);
 await f.click(f.buttons('Продолжить оплату')[0]);assert.ok(f.calls.some(c=>c.path==='orders/'+id+'/resume'));assert.equal(f.calls.some(c=>c.path==='checkout'),false);assert.equal(f.location.hostname,'yoomoney.ru');
});
test('a pending order discovered immediately before checkout blocks a second purchase',async()=>{
 const f=fixture();await f.ready;const pay=f.buttons('Перейти к оплате')[0];assert.equal(pay.disabled,false);f.setOrders([{id,state:'pending',days:90,price_minor:80000,created_at:Date.now()}]);await f.click(pay);assert.equal(f.calls.some(c=>c.path==='checkout'),false);assert.equal(pay.disabled,true);assert.equal(pay.hidden,true);assert.match(f.query('#account-message').textContent,/незавершённый платёж/);
});
test('old provider return restores its authoritative order period without overriding a newer explicit selection',async()=>{
 const old={id,state:'canceled',days:180,price_minor:140000,created_at:Date.now()},f=fixture({url:'https://family-spy.ru/vpn/cabinet/?lang=en#plans?order='+id,orders:[old],check:()=>({order:old})});await f.ready;await flush();assert.equal(f.query('[data-days="180"]').dataset.selected,'true');assert.equal(f.location.searchParams.get('period'),'180');
 let release;const delayed=new Promise(resolve=>release=resolve),g=fixture({url:'https://family-spy.ru/vpn/cabinet/#plans?order='+id,check:()=>delayed});await g.ready;g.dispatch('vpn-plan-selection',{days:90});release({order:old});await flush();assert.equal(g.query('[data-days="90"]').dataset.selected,'true');assert.equal(g.location.searchParams.get('period'),'90');
});
test('continuing an already paid order opens the connection and never follows a stale payment URL',async()=>{
 const paid={id,state:'paid',days:180,price_minor:140000,created_at:Date.now()},f=fixture({orders:[{...paid,state:'pending'}],subscription:{active:true,payment_confirmed:true,sync_state:'synced',profile_url:'https://example.invalid/fixture-sub'},resume:()=>{f.setOrders([paid]);return {order:paid};}});await f.ready;await f.click(f.buttons('Продолжить оплату')[0]);assert.equal(f.location.hash,'#devices?platform=macos');assert.equal(f.location.hostname,'family-spy.ru');assert.equal(f.calls.some(c=>c.path==='checkout'),false);const setup=f.root.all().find(n=>n.tagName==='A'&&n.textContent==='Настроить VPN');assert.equal(setup.href,'#devices?platform=macos');
});
test('checkout sends the same selected period and active language, while stored selection cannot cross accounts',async()=>{
 const f=fixture({url:'https://family-spy.ru/vpn/cabinet/?lang=en#plans?period=180'});await f.ready;await f.click(f.buttons('Перейти к оплате')[0]);const call=f.calls.find(c=>c.path==='checkout');assert.equal(call.body.days,180);assert.equal(call.body.lang,'en');
 const other=fixture({url:'https://family-spy.ru/vpn/cabinet/#plans',storage:f.storage,account:'second-account'});await other.ready;assert.equal(other.root.all().some(n=>n.dataset.selected==='true'),false);assert.equal(other.window.vpnPurchaseIntent.order,null);
});

test('language and route events cannot re-enable payment during the provider checkout request',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve),f=fixture({checkout:()=>pending});await f.ready;const pay=f.buttons('Перейти к оплате')[0],clicked=f.click(pay);await flush();assert.equal(pay.disabled,true);
 f.window.FPi18n.lang='en';f.dispatch('vpn-plan-selection',{days:180});assert.equal(pay.disabled,true);assert.equal(pay.dataset.locked,'true');release({orderId:id,url:'https://yoomoney.ru/checkout/fixture'});await clicked;assert.equal(pay.disabled,true);assert.equal(f.calls.filter(c=>c.path==='checkout').length,1);
});

test('explicitly choosing the already selected period defeats an older delayed return order',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve),storage=new Map([['family-vpn-purchase-v2',JSON.stringify({account:'fixture-account',days:180})]]),f=fixture({url:'https://family-spy.ru/vpn/cabinet/#plans?order='+id,storage,check:()=>pending});await f.ready;
 await f.click(f.query('[data-days="180"]').querySelector('button'));release({order:{id,state:'canceled',days:90,price_minor:80000}});await flush();assert.equal(f.query('[data-days="180"]').dataset.selected,'true');assert.equal(f.location.searchParams.get('period'),'180');
});
test('an unavailable pending payment never creates another order until the visitor explicitly confirms it',async()=>{
 const orphan={id,state:'pending',days:180,price_minor:140000,created_at:Date.now()};let approve=false;
 const f=fixture({orders:[orphan],resume:()=>({order:orphan,resumeReason:'missing'}),confirmNewOrder:()=>approve});await f.ready;assert.equal(f.buttons('Создать другой заказ').length,0);
 await f.click(f.buttons('Продолжить оплату')[0]);assert.equal(f.calls.some(c=>c.path==='checkout'),false);assert.equal(f.buttons('Создать другой заказ').length,1);
 await f.click(f.buttons('Создать другой заказ')[0]);assert.equal(f.calls.some(c=>c.path==='checkout'),false);assert.match(f.confirms[0],/180 дней/);assert.match(f.confirms[0],/Предыдущий платёж не отменится/);
 approve=true;await f.click(f.buttons('Создать другой заказ')[0]);const calls=f.calls.filter(c=>c.path==='checkout');assert.equal(calls.length,1);assert.equal(calls[0].body.days,180);assert.equal(f.location.hostname,'yoomoney.ru');
});
test('a different selected period can create another order only after explicit confirmation',async()=>{
 const f=fixture({orders:[{id,state:'pending',days:180,price_minor:140000,created_at:Date.now()}],confirmNewOrder:true});await f.ready;await f.click(f.query('[data-days="90"]').querySelector('button'));assert.equal(f.calls.some(c=>c.path==='checkout'),false);await f.click(f.buttons('Создать другой заказ')[0]);assert.equal(f.calls.find(c=>c.path==='checkout').body.days,90);assert.match(f.confirms[0],/90 дней/);
});

test('another order after a reload reveals its missing receipt email before confirmation or checkout',async()=>{
 const order={id,state:'pending',days:180,price_minor:140000,created_at:Date.now()},f=fixture({orders:[order],receiptEmail:'',confirmNewOrder:true,resume:()=>({order,resumeReason:'missing'})});await f.ready;await f.click(f.buttons('Продолжить оплату')[0]);await f.click(f.buttons('Создать другой заказ')[0]);
 const email=f.root.all().find(n=>n.tagName==='INPUT'&&n.type==='email');assert.equal(email.parentElement.hidden,false);assert.equal(email.focused,true);assert.equal(f.confirms.length,0);assert.equal(f.calls.some(c=>c.path==='checkout'),false);
 email.value='new-receipt@example.invalid';await f.click(f.buttons('Создать другой заказ')[0]);assert.equal(f.confirms.length,1);assert.equal(f.calls.find(c=>c.path==='checkout').body.email,'new-receipt@example.invalid');
});

test('switching language reformats cached history and checkout without another request',async()=>{
 const order={id,state:'canceled',days:180,price_minor:140000,created_at:Date.parse('2026-10-20T14:00:00Z')},f=fixture({orders:[order]});await f.ready;const count=f.calls.length;assert.match(f.query('.payment-order').textContent,/400,00/);
 f.window.FPi18n.lang='en';f.dispatch('fp-languagechange');assert.equal(f.calls.length,count);assert.match(f.query('.payment-order').textContent,/RUB\s*1,400\.00/);assert.match(f.query('.payment-order').textContent,/10\/20\/2026/);
});

test('switching languages reformats the ready overview expiry from the cached subscription',async()=>{
 const f=fixture({subscription:{active:true,payment_confirmed:true,sync_state:'synced',expires_at:Date.parse('2027-04-18T17:00:00Z'),profile_url:'https://example.invalid/fixture-sub'}});await f.ready;const count=f.calls.length;assert.match(f.query('.subscription').textContent,/18\.04\.2027/);
 f.window.FPi18n.lang='en';f.dispatch('fp-languagechange');await flush();assert.equal(f.calls.length,count);assert.match(f.query('.subscription').textContent,/4\/18\/2027/);
 f.window.FPi18n.lang='ru';f.dispatch('fp-languagechange');await flush();assert.equal(f.calls.length,count);assert.match(f.query('.subscription').textContent,/18\.04\.2027/);assert.equal(f.root.all().find(n=>n.tagName==='A'&&n.textContent==='Настроить VPN').href,'#devices?platform=macos');
});


test('Stars orders show their immutable unit amount and continue in Telegram instead of a RUB provider resume',async()=>{
 const order={id,state:'pending',days:30,price_minor:0,payment_amount:350,currency:'XTR',provider:'telegram_stars',created_at:Date.now()},f=fixture({orders:[order]});await f.ready;
 assert.match(f.query('.pending-checkout').textContent,/350 Stars/);assert.equal(f.buttons('Продолжить оплату').length,0);assert.equal(f.calls.some(c=>c.path.endsWith('/resume')),false);
 assert.ok(f.root.all().some(n=>n.tagName==='A'&&n.textContent==='Открыть оплату в Telegram'&&n.href==='https://t.me/family_pie_vpn_bot'));
});
