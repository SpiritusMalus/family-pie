import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const cabinet=readFileSync(new URL('../site/vpn/cabinet/index.html',import.meta.url),'utf8');
const landing=readFileSync(new URL('../site/vpn/index.html',import.meta.url),'utf8');
test('all cabinet navigation and public deep links retain their destination screen',()=>{
 const screens=new Set([...cabinet.matchAll(/data-screen="([^"]+)"/g)].map(m=>m[1]));
 const routes=[...cabinet.matchAll(/data-route="([^"]+)"/g)].map(m=>m[1]);
 const publicRoutes=[...landing.matchAll(/href="\/vpn\/cabinet\/#([^?"#]+)/g)].map(m=>m[1]);
 assert.ok(routes.length>0);assert.ok(publicRoutes.length>0);
 for(const route of [...routes,...publicRoutes])assert.ok(screens.has(route),'Missing destination screen: '+route);
});

import {runInNewContext} from 'node:vm';
const accountCode=readFileSync(new URL('../site/vpn/account.js',import.meta.url),'utf8');
const flushAuth=()=>new Promise(resolve=>setImmediate(resolve));
function authFixture(responses,search=''){
 const elements=new Map();
 for(const key of ['#login-form','#password-form','#auth-title','#account-message','.demo-label','.auth-layout > div > p','#password-form p','#login','#password','#current','#next','#repeat','#switch-account'])elements.set(key,{hidden:key==='#password-form',value:'test-only-password',dataset:{},listeners:new Map(),addEventListener(name,fn){this.listeners.set(name,fn);},focus(){this.focused=true;}});
 const calls=[],location={search,pathname:'/vpn/cabinet/auth/',hash:''};
 const document={querySelector:key=>elements.get(key)||null};
 const user={login:'test-only',role:'user',must_change:1},session={user,csrf:'csrf-fresh'};
 const window={FPi18n:{t:x=>x}};runInNewContext(accountCode,{window,document,location,URLSearchParams,fetch:async(path,options)=>{
  calls.push({path,options});const response=responses.shift();assert.ok(response,'Unexpected request '+path);const data=typeof response==='function'?await response():response;
  return {ok:!data.status||data.status===200,status:data.status||200,json:async()=>data.body||session};
 }});
 return {window,elements,calls,location,user,session,submit:async key=>elements.get(key).listeners.get('submit')({preventDefault(){},submitter:{disabled:false}})};
}
test('expired password form returns to login without attempting a password mutation',async()=>{
 const f=authFixture([{}, {status:401,body:{error:'Войди в аккаунт'}}]);await flushAuth();assert.equal(f.elements.get('.demo-label').hidden,true);
 await f.submit('#password-form');assert.equal(f.elements.get('#password-form').hidden,true);assert.equal(f.elements.get('#login-form').hidden,false);
 assert.match(f.elements.get('#account-message').textContent,/Сессия завершилась/);assert.equal(f.calls.some(c=>c.path.endsWith('/password')),false);
 for(const key of ['#password','#current','#next','#repeat'])assert.equal(f.elements.get(key).value,'');
 assert.equal(f.elements.get('.demo-label').hidden,false);
});
test('valid temporary password change refreshes CSRF and opens cabinet',async()=>{
 const f=authFixture([{}, {body:{user:{login:'test-only',role:'user',must_change:1},csrf:'csrf-new'}}, {body:{ok:true,csrf:'csrf-rotated'}}]);await flushAuth();await f.submit('#password-form');
 assert.equal(f.location.href,'/vpn/cabinet/');assert.equal(f.calls[2].options.headers['X-CSRF-Token'],'csrf-new');
 assert.match(f.elements.get('#password-form p').textContent,/После сохранения откроется личный кабинет/);
});
test('session loss during password submit recovers login; rejected current password keeps form',async()=>{
 const f=authFixture([{}, {}, {status:401,body:{error:'Войди в аккаунт'}}]);await flushAuth();await f.submit('#password-form');assert.equal(f.elements.get('#password-form').hidden,true);
 const wrong=authFixture([{}, {}, {status:400,body:{error:'Проверь текущий пароль и выбери новый'}}]);await flushAuth();await wrong.submit('#password-form');assert.equal(wrong.elements.get('#password-form').hidden,false);assert.match(wrong.elements.get('#account-message').textContent,/Проверь текущий пароль/);assert.equal(wrong.location.href,undefined);
});
test('login detects a browser that did not retain its session cookie',async()=>{
 const f=authFixture([{status:401,body:{error:'Войди в аккаунт'}},{},{status:401,body:{error:'Войди в аккаунт'}}]);await flushAuth();await f.submit('#login-form');assert.equal(f.elements.get('#password-form').hidden,true);assert.match(f.elements.get('#account-message').textContent,/Разреши cookies/);
});
test('reauthentication resumes a requested regular password change',async()=>{
 const user={login:'test-only',role:'user',must_change:0},f=authFixture([{status:401,body:{}},{body:{user,csrf:'login'}},{body:{user,csrf:'me'}}],'?change=1');await flushAuth();await f.submit('#login-form');assert.equal(f.elements.get('#password-form').hidden,false);assert.equal(f.elements.get('.demo-label').hidden,true);assert.equal(f.location.href,undefined);
});
test('late startup response cannot override a newer completed login',async()=>{
 let release;const old=new Promise(resolve=>release=resolve),user={login:'test-only',role:'user',must_change:1};
 const f=authFixture([()=>old,{body:{user,csrf:'login'}},{body:{user,csrf:'new'}}]);await f.submit('#login-form');release({body:{user:{...user,must_change:0},csrf:'old'}});await flushAuth();assert.equal(f.location.href,undefined);assert.equal(f.elements.get('#password-form').hidden,false);
});

test('alternative sign-in uses the verified admin role and preserves explicit user destinations',async()=>{
 const admin={login:'test-admin',role:'admin',must_change:0};
 const f=authFixture([{status:401,body:{}},{body:{user:admin,csrf:'admin-session'}}]);await flushAuth();await f.window.vpnFinishLogin();assert.equal(f.location.href,'/vpn/admin/');
 const deep=authFixture([{status:401,body:{}},{body:{user:admin,csrf:'admin-session'}}],'?next=%2Fvpn%2Fcabinet%2F%23settings');await flushAuth();await deep.window.vpnFinishLogin();assert.equal(deep.location.href,'/vpn/cabinet/#settings');
});
test('alternative sign-in enforces temporary password change and detects a missing session cookie',async()=>{
 const f=authFixture([{status:401,body:{}},{}]);await flushAuth();await f.window.vpnFinishLogin();assert.equal(f.elements.get('#password-form').hidden,false);assert.equal(f.location.href,undefined);
 const blocked=authFixture([{status:401,body:{}},{status:401,body:{error:'Войди в аккаунт'}}]);await flushAuth();await assert.rejects(blocked.window.vpnFinishLogin(),/Разреши cookies/);assert.equal(blocked.location.href,undefined);
});

test('temporary password screen can switch accounts without changing a password',async()=>{
 const f=authFixture([{}, {}, {body:{ok:true}}]);await flushAuth();const button={disabled:false};
 await f.elements.get('#switch-account').listeners.get('click')({currentTarget:button});
 assert.equal(f.elements.get('#login-form').hidden,false);assert.equal(f.elements.get('#password-form').hidden,true);assert.equal(button.disabled,false);
 assert.deepEqual(f.calls.map(c=>c.path),['/vpn/api/me','/vpn/api/me','/vpn/api/logout']);assert.equal(f.elements.get('#account-message').dataset.tone,'info');
});
