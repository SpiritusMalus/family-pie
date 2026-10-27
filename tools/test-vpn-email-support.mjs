import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {buildCustomerSite} from './build-customer-site.mjs';

const address='support@family-pie.ru';
const copySource=readFileSync(new URL('../site/vpn/support-email.js',import.meta.url),'utf8');
function fixture({clipboard=true,lang='ru'}={}){
 const copied=[],listeners={},windowListeners={},selection=[],status={dataset:{},textContent:''},anchor={href:'mailto:'+address};
 const button={hidden:true,disabled:false,closest:()=>contact};
 const contact={querySelector:selector=>selector==='[data-email-copy-status]'?status:anchor,querySelectorAll:()=>[button]};
 const document={querySelectorAll:selector=>selector==='[data-email-copy-result]'?[status]:[button],addEventListener:(type,handler)=>listeners[type]=handler,createRange:()=>({selectNodeContents:node=>selection.push(node)})};
 const window={FPi18n:{lang},addEventListener:(type,handler)=>windowListeners[type]=handler,getSelection:()=>({removeAllRanges(){},addRange(){}})};
 const navigator={clipboard:{writeText:async value=>{if(!clipboard)throw Error('Clipboard denied');copied.push(value);}}};
 runInNewContext(copySource,{document,window,navigator});
 return {copied,button,status,selection,window,anchor,click:()=>listeners.click({target:{closest:()=>button},preventDefault(){}}),language:value=>{window.FPi18n.lang=value;windowListeners['fp-languagechange']();}};
}

test('public support is included in the customer build with readable mail fallback before login or API access',async t=>{
 const directory=await mkdtemp(resolve('customer-site/dist-test-email-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const {output}=await buildCustomerSite(directory);
 for(const route of ['index.html','vpn/index.html','vpn/help/index.html','vpn/cabinet/auth/index.html','vpn/cabinet/index.html','vpn/connect/index.html','vpn/admin/index.html','vpn/offline.html']){
  const html=await readFile(resolve(output,route),'utf8');
  assert.match(html,/<a\b[^>]*href="mailto:support@family-pie\.ru"[^>]*>support@family-pie\.ru<\/a>/,route);
  assert.ok(html.includes('data-copy-support-email hidden'),route);
  for(const href of html.matchAll(/href="(mailto:[^"]*)"/g))assert.equal(href[1],'mailto:'+address,'No URL, token, or automatic customer data in email');
 }
 const help=await readFile(resolve(output,'vpn/help/index.html'),'utf8');
 assert.doesNotMatch(help,/(?:src="[^"]*(?:account|telegram-entry|password-recovery|cabinet-ui)\.js)|(?:\/vpn\/api\/)/);
 assert.match(help,/Вход в кабинет и Telegram не нужны/);assert.match(help,/Не присылай пароль, коды входа, личную VPN-ссылку или данные карты/);
 assert.match(await readFile(resolve(output,'vpn/cabinet/index.html'),'utf8'),/id="cabinet-load-recovery"[^>]*>[\s\S]*?href="\/vpn\/help\/"/);
 for(const route of ['index.html','vpn/index.html'])assert.match(await readFile(resolve(output,route),'utf8'),/<a[^>]*href="\/vpn\/help\/"/);
 const sw=await readFile(resolve(output,'vpn/sw.js'),'utf8');assert.match(sw,/family-vpn-shell-20261027-email-support/);assert.match(sw,/'\/vpn\/support-email\.js'/);assert.match(sw,/'\/i18n\/language\.css'/);
 const offline=await readFile(resolve(output,'vpn/offline.html'),'utf8');assert.match(offline,/<link rel="stylesheet" href="\/i18n\/language\.css">/);
});

test('copy uses only the published mailbox, supports repeated actions, and needs no API or URL access',async()=>{
 const f=fixture();assert.equal(f.button.hidden,false);await f.click();await f.click();
 assert.deepEqual(f.copied,[address,address]);assert.equal(f.status.textContent,'Почта скопирована');assert.equal(f.button.disabled,false);
 f.language('en');assert.equal(f.status.textContent,'Email address copied');f.language('ru');assert.equal(f.status.textContent,'Почта скопирована');
 const en=fixture({lang:'en'});await en.click();assert.equal(en.status.textContent,'Email address copied');
});

test('denied clipboard leaves a selectable address, manual instructions, and an enabled retry',async()=>{
 const f=fixture({clipboard:false});await f.click();assert.equal(f.copied.length,0);assert.deepEqual(f.selection,[f.anchor]);assert.equal(f.button.disabled,false);assert.equal(f.status.textContent,'Выдели адрес и скопируй его вручную.');
 f.language('en');assert.equal(f.status.textContent,'Select the address and copy it manually.');
});

test('public and recovery support copy translates without relying on the signed-in app',()=>{
 const window={};runInNewContext(readFileSync(new URL('../site/i18n/en.js',import.meta.url),'utf8'),{window});
 for(const source of ['Личный кабинет','Поможем с VPN','Скопировать адрес','Написать на почту','Не приходит код? Написать на почту','Помощь с оплатой','Telegram — по желанию: подписка и напоминания под рукой. Помощь доступна и по почте.']){
  assert.equal(typeof window.FP_EN[source],'string');assert.doesNotMatch(window.FP_EN[source],/[А-Яа-яЁё]/);
 }
});
