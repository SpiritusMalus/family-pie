import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../site/vpn/setup-progress.js',import.meta.url),'utf8');
function fixture({storage=new Map(),hash='',device='android',blocked=false}={}){
 class Element{constructor(){this.children=[];this.dataset={};this.events=new Map();this.attrs={};this.heading={focus(){this.focused=true;}};}replaceChildren(...nodes){this.children=nodes;}append(...nodes){this.children.push(...nodes);}setAttribute(key,value){this.attrs[key]=value;}addEventListener(name,fn){this.events.set(name,fn);}querySelector(){return this.heading;}focus(){}scrollIntoView(){this.scrolled=true;}}
 const progress=new Element(),complete=new Element(),steps=[1,2,3].map(value=>{const step=new Element();step.dataset.setupStep=String(value);return step;}),next=[2,4].map(value=>{const button=new Element();button.dataset.setupNext=String(value);return button;});
 const guide={querySelector:selector=>selector==='[data-setup-progress]'?progress:complete,querySelectorAll:()=>steps},location=new URL('https://family-spy.ru/vpn/cabinet/'+hash),listeners=new Map(),window={FPi18n:{t:x=>x},vpnDevicePlatform:()=>device,addEventListener:(key,fn)=>listeners.set(key,fn)};
 runInNewContext(source,{document:{querySelector:()=>guide,querySelectorAll:()=>next,createElement:()=>new Element()},window,location,URLSearchParams,history:{replaceState:(_a,_b,value)=>location.href=new URL(value,location).href},localStorage:{getItem:key=>{if(blocked)throw Error();return storage.get(key);},setItem:(key,value)=>{if(blocked)throw Error();storage.set(key,value);}}});
 return {window,steps,next,storage,location,progress,complete,update:(accountId='fixture',ready=true)=>window.vpnSetupProgress.update({accountId,ready}),stage:()=>steps.findIndex(step=>!step.hidden)+1};
}
test('installation and import advance only on explicit confirmation and survive a return to the browser',()=>{
 const f=fixture();f.update();assert.equal(f.stage(),1);f.next[0].events.get('click')();assert.equal(f.stage(),2);assert.equal(f.location.hash,'#devices?platform=android&step=import');
 const returned=fixture({storage:f.storage,hash:f.location.hash});returned.update();assert.equal(returned.stage(),2);returned.window.vpnSetupProgress.go(3);assert.equal(returned.stage(),3);assert.equal(returned.complete.hidden,true);returned.next[1].events.get('click')();assert.equal(returned.complete.hidden,false);
 const completed=fixture({storage:f.storage,hash:returned.location.hash});completed.update();assert.equal(completed.complete.hidden,false);
});
test('an unpaid or preparing connection cannot advance to a false completed state',()=>{
 const f=fixture();f.update('fixture',false);f.window.vpnSetupProgress.go(2);f.window.vpnSetupProgress.go(3);assert.equal(f.stage(),2);f.window.vpnSetupProgress.go(4);assert.equal(f.complete.hidden,true);
});
test('saved progress is scoped to the verified account and device, and denied storage keeps the flow usable',()=>{
 const f=fixture();f.update('first');f.window.vpnSetupProgress.go(3);const other=fixture({storage:f.storage});other.update('second');assert.equal(other.stage(),1);const ios=fixture({storage:f.storage,device:'ios'});ios.update('first');assert.equal(ios.stage(),1);
 const blocked=fixture({blocked:true});blocked.update();blocked.window.vpnSetupProgress.go(2);assert.equal(blocked.stage(),2);
});

const connectionSource=readFileSync(new URL('../site/vpn/connection-setup.js',import.meta.url),'utf8');
function connection(subscription){
 class Element{constructor(tag){this.tagName=tag;this.children=[];this.events=new Map();this._text='';}set textContent(value){this._text=value;this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}addEventListener(key,fn){this.events.set(key,fn);}all(){return this.children.flatMap(n=>[n,...n.all()]);}}
 const target=new Element('div'),advances=[],window={FPi18n:{lang:'ru',t:x=>x},vpnDevicePlatform:()=> 'android',vpnSetupProgress:{update(){},go:stage=>advances.push(stage)},addEventListener(){}};
 runInNewContext(connectionSource,{document:{querySelector:()=>target,createElement:tag=>new Element(tag)},window,location:{hash:'#devices'},URL,Date,navigator:{},});
 window.vpnConnectionSetup.update({accountId:'fixture',subscription,status(){}});return {target,advances};
}
test('a paid renewal awaiting provisioning never asks the customer with an old expiry to pay again',()=>{
 const f=connection({active:false,payment_confirmed:true,sync_state:'pending',expires_at:Date.now()-86400000});assert.match(f.target.textContent,/Готовим подключение; повторно платить не нужно/);assert.doesNotMatch(f.target.textContent,/Выбрать подписку|Подписка закончилась/);
});
test('opening the import app does not advance the checklist until the customer confirms the subscription was added',()=>{
 const f=connection({active:true,payment_confirmed:true,sync_state:'synced',profile_url:'https://example.invalid/private'}),add=f.target.all().find(n=>n.tagName==='a'&&n.textContent==='Добавить подписку в приложение'),next=f.target.all().find(n=>n.textContent==='Подписка добавлена. Дальше');add.events.get('click')();assert.equal(f.advances.length,0);next.events.get('click')();assert.deepEqual(f.advances,[3]);
});
