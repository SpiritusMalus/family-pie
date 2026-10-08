import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../site/vpn/telegram-link.js',import.meta.url),'utf8');
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.events={};this.hidden=false;}
 append(...children){this.children.push(...children);for(const c of children)c.parent=this;}
 setAttribute(k,v){this[k]=v;}
 addEventListener(k,v){this.events[k]=v;}
 remove(){this.parent.children=this.parent.children.filter(c=>c!==this);}
 async click(){if(!this.disabled)return this.events.click?.();}
}
const flush=()=>new Promise(r=>setImmediate(r));
async function fixture({blocked=false,available=true,linked=false,storage=new Map(),accountId="fixture-account",denyStorage=false}={}){
 const home=new Element('main'),settings=new Element('main'),listeners={},calls=[],popups=[],intervals=new Map();let count=0,now=0;
 let state={available,linked,enabled:linked,pending:false},fail=false,bad=false;
 const window={sessionStorage:{getItem:k=>{if(denyStorage)throw new Error('Storage denied');return storage.get(k)||null;},setItem:(k,v)=>{if(denyStorage)throw new Error('Storage denied');storage.set(k,v);}},addEventListener:(n,f)=>listeners[n]=f,open:()=>{if(blocked)return null;const p={location:{},opener:{},closed:false,close(){this.closed=true;}};popups.push(p);return p;}};
 const document={hidden:false,createElement:t=>new Element(t),addEventListener:(n,f)=>listeners[n]=f};
 const api=async(path,method='GET')=>{calls.push([path,method]);if(fail)throw new Error('Network unavailable');if(path==='telegram/link')return {url:bad?'https://wrong.example/?start=bind_'+'a'.repeat(43):'https://t.me/fictional_bot?start=bind_'+'a'.repeat(43)};if(path==='telegram/confirm')state={available:true,linked:true,enabled:true,pending:false};if(method==='DELETE')state={available:true,linked:false,enabled:false,pending:false};return state;};
 runInNewContext(source,{window,document,URL,Date:{now:()=>now},setInterval:f=>{intervals.set(++count,f);return count;},clearInterval:id=>intervals.delete(id)});
 await window.vpnTelegramLink({api,home,settings,accountId});
 const view=container=>{const card=container.children[0],actions=card.children[2];return {card,status:card.children[1],start:actions.children[0],confirm:actions.children[1],fallback:actions.children[2],cancel:actions.children[3],unlink:actions.children[4],later:actions.children[5]};};
 return {home,settings,h:view(home),s:view(settings),calls,popups,intervals,listeners,setState:s=>state={...state,...s},fail:()=>fail=true,bad:()=>bad=true,expire:()=>now=600001,tick:async()=>{for(const f of [...intervals.values()])f();await flush();}};
}
test('overview offers voluntary linking after login; no challenge until user clicks',async()=>{
 const f=await fixture();assert.equal(f.h.card.hidden,false);assert.equal(f.h.start.hidden,false);assert.equal(f.calls.length,1);assert.equal(f.calls[0][1],'GET');await f.h.later.click();assert.equal(f.home.children.length,0);assert.equal(f.settings.children.length,1);
});
test('one click opens bot and checks candidate automatically, with explicit ownership confirmation',async()=>{
 const f=await fixture();await f.h.start.click();assert.equal(f.popups[0].opener,null);assert.match(f.popups[0].location.href,/https:\/\/t.me/);assert.equal(f.intervals.size,1);
 f.setState({pending:true,candidate:'@fictional_user'});await f.tick();assert.equal(f.h.confirm.hidden,false);assert.match(f.h.status.textContent,/@fictional_user/);assert.equal(f.calls.some(([p])=>p==='telegram/confirm'),false);
 await f.h.confirm.click();assert.equal(f.h.card.hidden,true);assert.equal(f.s.unlink.hidden,false);assert.equal(f.intervals.size,0);
});
test('popup blocking leaves a usable link and reuses the challenge on retry',async()=>{
 const f=await fixture({blocked:true});await f.h.start.click();assert.equal(f.h.fallback.hidden,false);assert.match(f.h.fallback.href,/start=bind_/);await f.h.start.click();assert.equal(f.calls.filter(([p])=>p==='telegram/link').length,1);
});
test('malicious link is rejected and visible error survives loading cleanup',async()=>{
 const f=await fixture();f.bad();await f.h.start.click();assert.equal(f.popups[0].closed,true);assert.equal(f.h.fallback.hidden,true);assert.match(f.h.status.textContent,/Не удалось открыть/);assert.equal(f.h.start.disabled,false);
});
test('confirmation failure remains visible and does not claim a link',async()=>{
 const f=await fixture();f.setState({pending:true,candidate:'@fixture'});await f.listeners.focus();f.fail();await f.h.confirm.click();assert.equal(f.h.card.hidden,false);assert.equal(f.h.status.textContent,'Network unavailable');assert.equal(f.h.confirm.disabled,false);
});
test('expired challenge stops polling and creates a fresh link on next click',async()=>{
 const f=await fixture();await f.h.start.click();f.expire();await f.tick();assert.equal(f.intervals.size,0);assert.equal(f.h.fallback.hidden,true);assert.match(f.h.status.textContent,/Ссылка истекла/);await f.h.start.click();assert.equal(f.calls.filter(([p])=>p==='telegram/link').length,2);
 const cached=await fixture();await cached.h.start.click();cached.listeners.pagehide();cached.expire();cached.listeners.pageshow();await flush();await cached.h.start.click();assert.equal(cached.calls.filter(([p])=>p==='telegram/link').length,2);
});
test('connected users are not prompted; disconnect and unavailable states remain actionable',async()=>{
 const f=await fixture({linked:true});assert.equal(f.h.card.hidden,true);await f.s.unlink.click();assert.equal(f.h.card.hidden,false);assert.equal(f.s.start.hidden,false);
 const unavailable=await fixture({available:false});assert.equal(unavailable.h.start.disabled,true);assert.match(unavailable.h.status.textContent,/временно недоступен/);
});

test('Later survives reload for the same account without hiding settings or another account',async()=>{
 const storage=new Map(),first=await fixture({storage,accountId:'fixture-a'});
 await first.h.later.click();
 const reloaded=await fixture({storage,accountId:'fixture-a'});
 assert.equal(reloaded.h.card.hidden,true);assert.equal(reloaded.s.card.hidden,false);assert.equal(reloaded.s.start.hidden,false);
 const different=await fixture({storage,accountId:'fixture-b'});assert.equal(different.h.card.hidden,false);
 const newTab=await fixture({accountId:'fixture-a'});assert.equal(newTab.h.card.hidden,false);
});
test('denied session storage does not break Telegram linking or Later',async()=>{
 const f=await fixture({denyStorage:true});assert.equal(f.h.card.hidden,false);
 await f.h.later.click();assert.equal(f.home.children.length,0);assert.equal(f.s.start.disabled,false);
});
