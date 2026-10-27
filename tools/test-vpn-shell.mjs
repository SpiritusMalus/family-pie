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
function authFixture(responses,search='',options={}){
 const elements=new Map();
 for(const key of ['#login-form','#password-form','#auth-title','#account-message','.demo-label','.auth-layout > div > p','#password-form p','#login','#password','#current','#next','#repeat','#switch-account'])elements.set(key,{hidden:key==='#password-form',value:'test-only-password',dataset:{},listeners:new Map(),addEventListener(name,fn){this.listeners.set(name,fn);},focus(){this.focused=true;}});
 const calls=[],location={search,pathname:options.pathname||'/vpn/cabinet/auth/',hash:options.hash||''};
 if(options.cabinet)elements.delete('#login-form');
 if(options.loading)for(const key of ['#cabinet-load-state','#cabinet-load-message','#cabinet-load-recovery','#cabinet-load-retry'])elements.set(key,{hidden:true,listeners:new Map(),addEventListener(name,fn){this.listeners.set(name,fn);}});
 const document={querySelector:key=>elements.get(key)||null};
 const user={login:'test-only',role:'user',must_change:1},session={user,csrf:'csrf-fresh'};
 const window={FPi18n:{t:x=>x,...(options.lang?{lang:options.lang}:{})}};runInNewContext(accountCode,{AbortSignal,window,document,location,URL,URLSearchParams,fetch:async(path,options)=>{
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
test('a failed restored-session request gives a visible retry and support path instead of a blank cabinet',async()=>{
 const f=authFixture([{status:503,body:{error:'Сервис временно недоступен'}}],'',{cabinet:true,loading:true});await flushAuth();assert.equal(f.elements.get('#cabinet-load-message').textContent,'Сервис временно недоступен');assert.equal(f.elements.get('#cabinet-load-recovery').hidden,false);assert.ok(f.elements.get('#cabinet-load-retry').listeners.has('click'));assert.equal(f.location.href,undefined);
});
test('valid temporary password change refreshes CSRF and opens cabinet',async()=>{
 const f=authFixture([{}, {body:{user:{login:'test-only',role:'user',must_change:1},csrf:'csrf-new'}}, {body:{ok:true,csrf:'csrf-rotated'}}]);await flushAuth();await f.submit('#password-form');
 assert.equal(f.location.href,'/vpn/cabinet/');assert.equal(f.calls[2].options.headers['X-CSRF-Token'],'csrf-new');
 assert.match(f.elements.get('#password-form p').textContent,/После сохранения откроется личный кабинет/);
});
test('a verified nonpassword sign-in sets a password without the forgotten password and opens the intended cabinet',async()=>{
 const body={user:{login:'fixture-recovered',role:'user',must_change:1},csrf:'fresh',authMethod:'email',passwordSetupAllowed:true},f=authFixture([{body},{body},{body:{ok:true}}]);await flushAuth();assert.equal(f.elements.get('#current').required,false);assert.match(f.elements.get('#password-form p').textContent,/Подписка останется/);await f.submit('#password-form');assert.equal(f.calls[2].path,'/vpn/api/password/set');assert.deepEqual(JSON.parse(f.calls[2].options.body),{next:'test-only-password'});assert.equal(f.location.href,'/vpn/cabinet/');
});
test('expired recovery verification never silently falls back to asking the forgotten password',async()=>{
 const body={user:{login:'fixture-recovered',role:'user',must_change:1},csrf:'fresh',authMethod:'email',passwordSetupAllowed:true},f=authFixture([{body},{body:{...body,passwordSetupAllowed:false}}]);await flushAuth();await f.submit('#password-form');assert.equal(f.calls.length,2);assert.equal(f.elements.get('#password-form').hidden,true);assert.match(f.elements.get('#account-message').textContent,/Подтверждение устарело/);
});
test('a normal recent password sign-in still asks for the current password when changing it',async()=>{
 const body={user:{login:'fixture-password',role:'user',must_change:0},csrf:'fresh',authMethod:'password',passwordSetupAllowed:true},f=authFixture([{body},{body},{body:{ok:true}}],'?change=1');await flushAuth();assert.equal(f.elements.get('#current').required,true);await f.submit('#password-form');assert.equal(f.calls[2].path,'/vpn/api/password');assert.ok(JSON.parse(f.calls[2].options.body).current);
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

test('each public tariff opens registration with its language and cabinet selection intact',async()=>{
 for(const days of [30,90,180,365])for(const lang of ['ru','en']){
  const f=authFixture([{status:401,body:{}}],'?lang='+lang,{cabinet:true,pathname:'/vpn/cabinet/',hash:'#plans?period='+days});await flushAuth();
  const auth=new URL(f.location.href,'https://family-spy.ru');
  assert.equal(auth.pathname,'/vpn/cabinet/auth/');assert.equal(auth.searchParams.get('mode'),'register');assert.equal(auth.searchParams.get('period'),String(days));assert.equal(auth.searchParams.get('lang'),lang);
  assert.equal(auth.searchParams.get('next'),`/vpn/cabinet/?lang=${lang}#plans?period=${days}`);
  const resumed=authFixture([{status:401,body:{}},{body:{user:{role:'user',must_change:0},csrf:'resumed'}}],auth.search);await flushAuth();
  await resumed.window.vpnFinishLogin();assert.equal(resumed.location.href,auth.searchParams.get('next'));
 }
});

test('plain cabinet access opens sign-in and keeps the active page language',async()=>{
 const f=authFixture([{status:401,body:{}}],'?lang=en',{cabinet:true,pathname:'/vpn/cabinet/'});await flushAuth();
 const auth=new URL(f.location.href,'https://family-spy.ru');assert.equal(auth.searchParams.has('mode'),false);assert.equal(auth.searchParams.get('lang'),'en');
 assert.equal(f.window.vpnAuthFlow.read({pathname:auth.pathname,search:auth.search,hash:''}).mode,'login');
 const saved=authFixture([{status:401,body:{}}],'',{cabinet:true,pathname:'/vpn/cabinet/',lang:'en'});await flushAuth();assert.equal(new URL(saved.location.href,'https://family-spy.ru').searchParams.get('lang'),'en');
});

test('password sign-in and forced password replacement retain a chosen subscription',async()=>{
 const next='/vpn/cabinet/?lang=en#plans?period=90',search='?lang=en&mode=register&period=90&next='+encodeURIComponent(next),user={login:'test-only',role:'user',must_change:0};
 const f=authFixture([{status:401,body:{}},{body:{user,csrf:'login'}},{body:{user,csrf:'session'}}],search);await flushAuth();await f.submit('#login-form');assert.equal(f.location.href,next);
 const temporary=authFixture([{}, {}, {body:{ok:true}}],search);await flushAuth();await temporary.submit('#password-form');assert.equal(temporary.location.href,next);
});

test('safe auth destinations reject other origins, path escapes, query abuse and malformed periods',async()=>{
 const f=authFixture([{status:401,body:{}}]);await flushAuth();const flow=f.window.vpnAuthFlow;
 for(const bad of ['https://evil.invalid/vpn/cabinet/','//evil.invalid/vpn/cabinet/','/vpn/cabinet/../admin/','/vpn/cabinet/%2e%2e/admin/','/vpn/cabinet/\\evil','/vpn/admin/','/vpn/cabinet/\n','/vpn/cabinet/?lang=en&lang=ru','/vpn/cabinet/?next=https://evil.invalid','/vpn/cabinet/?lang=xx','/vpn/cabinet/?period=999','/vpn/cabinet/'+ 'x'.repeat(1024)]){
  const source={pathname:'/vpn/cabinet/auth/',search:'?next='+encodeURIComponent(bad),hash:''};
  assert.equal(flow.read(source).next,null,bad);assert.equal(flow.destination({role:'admin'},source),'/vpn/admin/',bad);
 }
 for(const bad of ['0','7','030','90.0','Infinity','1e2','NaN'])assert.equal(flow.read({search:'?period='+bad,pathname:'/vpn/cabinet/auth/',hash:''}).period,null);
 assert.equal(flow.read({search:'?next='+encodeURIComponent('/vpn/cabinet/?period=180&lang=en#plans'),pathname:'/vpn/cabinet/auth/',hash:''}).period,180);
 assert.equal(flow.destination({role:'user'},{search:'?lang=ru&next='+encodeURIComponent('/vpn/cabinet/?lang=en#plans?period=365'),pathname:'/vpn/cabinet/auth/',hash:''}),'/vpn/cabinet/?lang=ru#plans?period=365');
 assert.equal(flow.read({search:'?mode=login&period=30',pathname:'/vpn/cabinet/auth/',hash:''}).mode,'login');
 assert.equal(flow.read({search:'?reauth=1&period=30',pathname:'/vpn/cabinet/auth/',hash:''}).mode,'login');
});

const cabinetUiCode=readFileSync(new URL('../site/vpn/cabinet-ui.js',import.meta.url),'utf8');
function signupFixture({mode='register',period=90,lang='ru',planResponses=[{plans:[{days:90,priceMinor:80045}],available:true}]}={}){
 const observers=new Map();
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.events=new Map();this._text='';this._hidden=false;this.classList={add:(...names)=>{this.className=[this.className||'',...names].join(' ');}};}
  set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  set hidden(value){const changed=this._hidden!==value;this._hidden=value;if(changed&&observers.has(this))queueMicrotask(observers.get(this));}get hidden(){return this._hidden;}
  append(...nodes){for(const n of nodes){if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(c=>c!==n);n.parentElement=this;this.children.push(n);}}
  insertBefore(n,before){n.parentElement=this;this.children.splice(this.children.indexOf(before),0,n);}
  replaceChildren(...nodes){this._text='';this.children=[];this.append(...nodes);}
  setAttribute(key,value){this.attrs[key]=String(value);}addEventListener(name,fn){this.events.set(name,fn);}focus(){this.focused=true;}
  querySelector(selector){return this.all().find(n=>selector[0]==='#'?n.id===selector.slice(1):selector[0]==='.'?(n.className||'').split(' ').includes(selector.slice(1)):n.tagName.toLowerCase()===selector)||null;}
  all(){return this.children.flatMap(n=>[n,...n.all()]);}
 }
 const root=new Element('main'),context=new Element('div'),intro=new Element('p'),selected=new Element('section'),panel=new Element('section'),title=new Element('h2'),loginForm=new Element('form'),passwordForm=new Element('form'),message=new Element('p'),label=new Element('p'),existingLogin=new Element('input');
 selected.id='auth-selected-plan';title.id='auth-title';loginForm.id='login-form';passwordForm.id='password-form';passwordForm.hidden=true;message.id='account-message';label.className='demo-label';existingLogin.id='login';loginForm.append(existingLogin);context.append(intro,selected);panel.append(title,loginForm,passwordForm,message,label);root.append(context,panel);
 const document={createElement:tag=>new Element(tag),querySelector:selector=>selector==='.auth-layout > div > p'?intro:root.querySelector(selector)};
 const listeners=new Map(),calls=[],location=new URL('https://family-spy.ru/vpn/cabinet/auth/?mode='+mode+(period?'&period='+period+'&next='+encodeURIComponent('/vpn/cabinet/?lang=ru#plans?period='+period):'')),window={FPi18n:{lang,t:x=>x},vpnAuthFlow:{read:()=>({mode,period,lang})},PublicKeyCredential:class{},vpnLoginDestination:()=>'/vpn/cabinet/?lang='+window.FPi18n.lang+'#plans?period='+period,addEventListener:(name,fn)=>listeners.set(name,fn),vpnFinishLogin:async()=>{window.finished=(window.finished||0)+1;}};
 const history={replaceState(_a,_b,value){const next=new URL(value,location);location.href=next.href;}};
 runInNewContext(cabinetUiCode,{document,window,location,history,URLSearchParams,Intl,AbortSignal,Uint8Array,MutationObserver:class{constructor(fn){this.fn=fn;}observe(el){observers.set(el,this.fn);}},fetch:async(path,options)=>{
  calls.push({path,options});let data=path.endsWith('/auth-options')?{google:true,email:true}:path.endsWith('/plans')?planResponses.shift():{ok:true};
  if(data instanceof Error)throw data;assert.ok(data,'Unexpected request '+path);return {ok:true,json:async()=>data};
 }});
 return {root,panel,intro,selected,title,loginForm,passwordForm,message,window,location,calls,dispatch:name=>listeners.get(name)?.(),find:selector=>root.querySelector(selector),click:async el=>el.events.get('click')(),submit:async el=>el.events.get('submit')({preventDefault(){},submitter:el.all().find(n=>n.tagName==='BUTTON')})};
}

test('purchase auth presents registration, the exact live price, and an obvious returning-user switch',async()=>{
 const f=signupFixture();await flushAuth();const registration=f.find('#register-form');assert.equal(f.loginForm.hidden,true);assert.equal(registration.hidden,false);assert.match(f.selected.textContent,/90 дней/);assert.match(f.selected.textContent,/800,45/);assert.equal(f.find('.auth-alternatives').hidden,true);assert.equal(f.find('.auth-switch').textContent,'Уже есть аккаунт? Войти');
 await f.click(f.find('.auth-switch'));assert.equal(f.loginForm.hidden,false);assert.equal(registration.hidden,true);assert.equal(f.find('.auth-alternatives').hidden,false);assert.match(f.selected.textContent,/800,45/);assert.equal(new URLSearchParams(f.location.search).get('mode'),'login');
 await f.click(f.find('.auth-switch'));assert.equal(registration.hidden,false);assert.equal(f.loginForm.hidden,true);assert.equal(new URLSearchParams(f.location.search).get('period'),'90');
});

test('normal sign-in, forced password change, and session recovery keep one active account form',async()=>{
 const f=signupFixture({mode:'login',period:null});await flushAuth();assert.equal(f.loginForm.hidden,false);assert.equal(f.find('#register-form').hidden,true);assert.ok(!f.selected.textContent);assert.equal(f.find('.auth-switch').textContent,'Нет аккаунта? Создать аккаунт');
 f.loginForm.hidden=true;f.passwordForm.hidden=false;await flushAuth();assert.equal(f.find('.auth-methods').hidden,true);
 f.passwordForm.hidden=true;f.dispatch('vpn-auth-login-view');await flushAuth();assert.equal(f.find('.auth-methods').hidden,false);assert.equal(f.loginForm.hidden,false);assert.equal(f.find('#register-form').hidden,true);
});

test('signup summary retries failed prices and retains the selection when the language changes',async()=>{
 const f=signupFixture({planResponses:[new Error('offline'),{plans:[{days:90,priceMinor:80045}],available:false}]});await flushAuth();assert.match(f.selected.textContent,/Не удалось загрузить цену/);assert.ok(f.find('.auth-plan-retry'));await f.click(f.find('.auth-plan-retry'));assert.match(f.selected.textContent,/800,45/);assert.match(f.selected.textContent,/Оплата сейчас недоступна/);
 f.window.FPi18n.lang='en';f.dispatch('fp-languagechange');assert.match(f.selected.textContent,/RUB\s*800\.45/);assert.equal(new URLSearchParams(f.location.search).get('lang'),'en');assert.equal(new URLSearchParams(f.location.search).get('period'),'90');assert.equal(new URLSearchParams(f.location.search).get('next'),'/vpn/cabinet/?lang=ru#plans?period=90');assert.equal(f.find('.auth-plan-change').href,'/?lang=en#vpn-pricing');
});

test('registration keeps terms consent and confirmation before the normal verified-login completion',async()=>{
 const f=signupFixture();await flushAuth();const form=f.find('#register-form'),inputs=form.all().filter(n=>n.tagName==='INPUT'),[login,password,repeat,consent]=inputs;assert.equal(consent.required,true);assert.equal(password.minLength,12);assert.equal(repeat.minLength,12);login.value='fixture.user';password.value='A-test-only-password';repeat.value='different';consent.checked=true;
 await f.submit(form);assert.equal(f.calls.some(c=>c.path.endsWith('/register')),false);assert.match(f.message.textContent,/Пароли не совпадают/);
 repeat.value=password.value;await f.submit(form);const call=f.calls.find(c=>c.path.endsWith('/register'));assert.equal(JSON.parse(call.options.body).acceptedTerms,true);assert.equal(JSON.parse(call.options.body).login,'fixture.user');assert.equal(f.window.finished,1);
});

const appCode=readFileSync(new URL('../site/vpn/app.js',import.meta.url),'utf8');
function preferredPlatform(navigator,saved=null){
 const storage=new Map(saved?[['family-vpn-platform',saved]]:[]),window={addEventListener(){}};
 runInNewContext(appCode,{window,navigator,location:{hash:'',search:''},document:{querySelector:()=>null,querySelectorAll:()=>[],body:{classList:{toggle(){}}}},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}});
 return window.vpnDevicePlatform();
}
test('device setup detects mobile browsers before desktop platform fallbacks and respects an explicit device preference',()=>{
 assert.equal(preferredPlatform({platform:'Linux aarch64',userAgent:'Mozilla/5.0 (Android 15; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0'}),'android');
 assert.equal(preferredPlatform({platform:'MacIntel',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X) Mobile',maxTouchPoints:5}),'ios');
 assert.equal(preferredPlatform({platform:'MacIntel',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',maxTouchPoints:0}),'macos');
 assert.equal(preferredPlatform({userAgentData:{platform:'Windows'},platform:'Win32',userAgent:'Mozilla/5.0 (Windows NT 10.0)'}),'windows');
 assert.equal(preferredPlatform({platform:'Linux aarch64',userAgent:'Android'},'tv'),'tv');
});
