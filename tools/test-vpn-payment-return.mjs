import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../site/vpn/payment-return.js',import.meta.url),'utf8');
const id='01234567-89ab-4cde-8fab-0123456789ab';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({hash='#plans?order='+id,saved=null,state='paid',sub={active:true,payment_confirmed:true,sync_state:'synced'},failure=null}={}) {
 const listeners=new Map(),storage=new Map(saved?[['family-vpn-pending-order',saved]]:[]),messages=[],calls=[],routes=[];
 let tick,cleared=false;
 const window={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);},dispatchEvent:event=>listeners.get(event.type)?.(event)};
 const location={hash,pathname:'/vpn/cabinet/',search:''};
 const history={replaceState:(_a,_b,path)=>{routes.push(path);location.hash=path.slice(path.indexOf('#'));}};
 runInNewContext(code,{window,location,history,URLSearchParams,Event,sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>cleared=true});
 window.vpnPaymentReturn({api:async path=>{calls.push(path);if(failure)throw failure;return {order:{state}};},refreshOrders:async()=>{},refreshSubscription:async()=>{},getSubscription:()=>sub,status:text=>messages.push(text)});
 return {window,location,messages,calls,routes,storage,get cleared(){return cleared;},tick:()=>tick(),setState:value=>state=value,setSub:value=>sub=value};
}
test('verified paid order opens ready connection and clears pending recovery',async()=>{
 const f=fixture({saved:id});await flush();assert.equal(f.location.hash,'#home');assert.equal(f.cleared,true);assert.equal(f.storage.size,0);assert.match(f.messages.at(-1),/подключение готово/);
});
test('confirmed payment remains pending until physical provisioning completes',async()=>{
 const f=fixture({sub:{active:false,payment_confirmed:true,sync_state:'pending'}});await flush();assert.equal(f.location.hash,'#home');assert.equal(f.cleared,false);assert.match(f.messages.at(-1),/Готовим подключение/);
 f.setSub({active:true,payment_confirmed:true,sync_state:'synced'});await f.tick();assert.equal(f.cleared,true);assert.match(f.messages.at(-1),/подключение готово/);
});
test('an existing active subscription does not turn an unconfirmed order into success',async()=>{
 const f=fixture({state:'pending'});await flush();assert.equal(f.routes.length,0);assert.equal(f.cleared,false);assert.match(f.messages.at(-1),/Ждём подтверждение/);
});
test('original checkout tab recovers on focus even when bank does not return to the URL',async()=>{
 const f=fixture({hash:'#plans?period=30',saved:id,state:'pending'});await flush();f.setState('paid');f.window.dispatchEvent(new Event('focus'));await flush();assert.equal(f.location.hash,'#home');assert.equal(f.calls.length,2);assert.equal(f.cleared,true);
});
test('foreign or missing order errors are not interpreted as successful payment',async()=>{
 const f=fixture({saved:id,failure:Object.assign(new Error('Заказ не найден'),{status:404})});await flush();assert.equal(f.routes.length,0);assert.equal(f.cleared,true);assert.equal(f.storage.size,0);assert.equal(f.messages.at(-1),'Заказ не найден');
});
test('temporary network failure keeps recovery and terminal cancel removes it',async()=>{
 const f=fixture({saved:id,state:'canceled'});await flush();assert.equal(f.routes.length,0);assert.equal(f.cleared,true);assert.equal(f.storage.size,0);assert.match(f.messages.at(-1),/отменён/);
 const error=fixture({saved:id,failure:new Error('Сеть недоступна')});await flush();assert.equal(error.cleared,false);assert.equal(error.storage.size,1);assert.equal(error.routes.length,0);
});
