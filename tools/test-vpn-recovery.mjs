import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../site/vpn/password-recovery.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({fragment='',respond=()=>({})}={}){
 const elements=new Map(),calls=[],events=[];
 class Element{constructor(){this.hidden=false;this.value='';this.dataset={};this.events=new Map();this.children=[];}addEventListener(name,fn){this.events.set(name,fn);}focus(){this.focused=true;}append(child){this.children.push(child);}}
 for(const id of ['password-recovery','recovery-message','login-form','password-form','auth-title','account-message','login','password','forgot-password','recovery-start','recovery-reset','recovery-success','recovery-identifier','recovery-title','recovery-code-row','recovery-code','recovery-resend','recovery-instructions','recovery-password','recovery-repeat','recovery-back','recovery-sign-in','recovery-request','recovery-email-unavailable','recovery-telegram','recovery-telegram-hint'])elements.set('#'+id,new Element());
 elements.set('.auth-methods',new Element());elements.set('.demo-label',new Element());elements.get('#password-recovery').hidden=true;
 const location=new URL('https://family-spy.ru/vpn/cabinet/auth/?lang=en&next='+encodeURIComponent('/vpn/cabinet/#devices?platform=ios')+fragment);
 const window={FPi18n:{t:x=>x},dispatchEvent:event=>events.push(event.type),addEventListener(){}},history={replaceState:(_a,_b,path)=>{location.href=new URL(path,location).href;}};
 runInNewContext(source,{document:{querySelector:key=>elements.get(key),createElement:()=>new Element()},window,location,history,URLSearchParams,AbortSignal,Date,CustomEvent:class{constructor(type){this.type=type;}},fetch:async(path,options={})=>{
  const call={path,options,hash:location.hash,body:options.body?JSON.parse(options.body):null};calls.push(call);
  const result=path.endsWith('auth-options')?{body:{recoveryEmail:true,recoveryTelegram:true}}:await respond(call);
  if(result instanceof Error)throw result;
  return {ok:result.status?result.status<400:true,json:async()=>result.body||result};
 }});
 return {elements,calls,events,window,location,get:key=>elements.get('#'+key),click:async key=>elements.get('#'+key).events.get('click')({preventDefault(){}}),submit:async key=>elements.get('#'+key).events.get('submit')({preventDefault(){},submitter:new Element()})};
}
test('visible recovery preserves the intended setup and ends in sign-in without requesting the old password',async()=>{
 const f=fixture({respond:call=>call.path.endsWith('/request')?{challengeId:'fixture',retryAfter:60}:{ok:true,login:'fixture-user'}});await flush();f.get('login').value='fixture-user';await f.click('forgot-password');
 assert.equal(f.get('recovery-identifier').value,'fixture-user');assert.equal(f.window.vpnPasswordRecovery.active,true);assert.equal(f.get('login-form').hidden,true);
 await f.submit('recovery-request');assert.equal(f.get('recovery-reset').hidden,false);assert.equal(f.get('recovery-code').required,true);
 f.get('recovery-code').value='12345678';f.get('recovery-password').value=f.get('recovery-repeat').value='Synthetic-new-password!';await f.submit('recovery-reset');
 const request=f.calls.find(c=>c.path.endsWith('/confirm'));assert.deepEqual(request.body,{challengeId:'fixture',code:'12345678',password:'Synthetic-new-password!'});assert.equal(f.get('recovery-success').hidden,false);assert.equal(f.get('recovery-password').value,'');
 await f.click('recovery-sign-in');assert.equal(f.get('login').value,'fixture-user');assert.equal(f.get('password').value,'');assert.equal(f.window.vpnPasswordRecovery.active,false);assert.ok(f.events.includes('vpn-auth-login-view'));assert.equal(new URLSearchParams(f.location.search).get('next'),'/vpn/cabinet/#devices?platform=ios');assert.equal(f.calls.some(c=>c.path.endsWith('/login')),false);
});
test('fragment recovery scrubs before all requests, previews the account, and consumes only on explicit submit',async()=>{
 const token='a'.repeat(43),f=fixture({fragment:'#recovery='+token,respond:()=>({login:'fixture-legacy'})});await flush();
 assert.equal(f.location.hash,'');assert.equal(f.window.vpnRecoveryEntry,true);assert.ok(f.calls.every(c=>c.hash===''));assert.equal(f.get('recovery-code').required,false);assert.equal(f.calls.some(c=>c.path.endsWith('/reset')),false);
 f.get('recovery-password').value=f.get('recovery-repeat').value='Synthetic-new-password!';await f.submit('recovery-reset');const reset=f.calls.find(c=>c.path.endsWith('/reset'));assert.equal(reset.body.token,token);assert.equal(reset.options.referrerPolicy,'no-referrer');assert.equal(reset.options.cache,'no-store');assert.equal(f.get('recovery-success').hidden,false);
});
test('invalid link and mismatching password never submit a password mutation',async()=>{
 const invalid=fixture({fragment:'#recovery=invalid'});await flush();assert.equal(invalid.calls.filter(c=>c.options.method==='POST').length,0);assert.match(invalid.get('recovery-message').textContent,/Ссылка устарела/);
 const f=fixture({respond:()=>({challengeId:'fixture'})});await flush();await f.click('forgot-password');f.get('recovery-identifier').value='fixture';await f.submit('recovery-request');f.get('recovery-password').value='Synthetic-new-password!';f.get('recovery-repeat').value='different';await f.submit('recovery-reset');assert.equal(f.calls.some(c=>c.path.endsWith('/confirm')),false);assert.match(f.get('recovery-message').textContent,/не совпадают/);
});
test('canceling a pending token preview cannot reopen recovery or replace the sign-in form',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve),f=fixture({fragment:'#recovery='+'b'.repeat(43),respond:()=>pending});await f.click('recovery-back');release({login:'fixture'});await flush();assert.equal(f.window.vpnPasswordRecovery.active,false);assert.equal(f.get('password-recovery').hidden,true);assert.equal(f.calls.some(c=>c.path.endsWith('/reset')),false);
});
test('request failure remains recoverable and immediate resend cannot generate another code',async()=>{
 const f=fixture({respond:()=>({challengeId:'fixture',retryAfter:60})});await flush();await f.click('forgot-password');f.get('recovery-identifier').value='fixture';await f.submit('recovery-request');await f.click('recovery-resend');assert.equal(f.calls.filter(c=>c.path.endsWith('/request')).length,1);assert.match(f.get('recovery-message').textContent,/через минуту/);assert.equal(f.get('recovery-resend').disabled,false);
 const failed=fixture({respond:()=>new Error('network')});await flush();await failed.click('forgot-password');failed.get('recovery-identifier').value='fixture';await failed.submit('recovery-request');assert.match(failed.get('recovery-message').textContent,/Сервис не ответил/);assert.equal(failed.get('recovery-start').hidden,false);
});
