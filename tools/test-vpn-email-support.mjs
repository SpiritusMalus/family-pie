import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {buildCustomerSite} from './build-customer-site.mjs';

const address='support@family-pie.ru';

test('public support is included in the customer build with readable mail fallback before login or API access',async t=>{
 const directory=await mkdtemp(resolve('customer-site/dist-test-email-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const {output}=await buildCustomerSite(directory);
 for(const route of ['index.html','vpn/index.html','vpn/help/index.html','vpn/cabinet/auth/index.html','vpn/cabinet/index.html','vpn/connect/index.html','vpn/admin/index.html','vpn/offline.html']){
  const html=await readFile(resolve(output,route),'utf8');
  assert.match(html,/<a\b[^>]*href="mailto:support@family-pie\.ru"[^>]*>support@family-pie\.ru<\/a>/,route);
  assert.doesNotMatch(html,/data-copy-support-email|data-email-copy-status|support-email\.js|Скопировать адрес|Copy email address/,route);
  for(const href of html.matchAll(/href="(mailto:[^"]*)"/g))assert.equal(href[1],'mailto:'+address,'No URL, token, or automatic customer data in email');
 }
 const help=await readFile(resolve(output,'vpn/help/index.html'),'utf8');
 assert.doesNotMatch(help,/(?:src="[^"]*(?:account|telegram-entry|password-recovery|cabinet-ui)\.js)|(?:\/vpn\/api\/)/);
 assert.match(help,/Вход в кабинет и Telegram не нужны/);assert.match(help,/Не присылай пароль, коды входа, личную VPN-ссылку или данные карты/);
 assert.match(await readFile(resolve(output,'vpn/cabinet/index.html'),'utf8'),/id="cabinet-load-recovery"[^>]*>[\s\S]*?href="\/vpn\/help\/"/);
 for(const route of ['index.html','vpn/index.html'])assert.match(await readFile(resolve(output,route),'utf8'),/<a[^>]*href="\/vpn\/help\/"/);
 const sw=await readFile(resolve(output,'vpn/sw.js'),'utf8');assert.match(sw,/family-vpn-shell-20261028-email-address/);assert.doesNotMatch(sw,/support-email\.js/);assert.match(sw,/'\/i18n\/language\.css'/);
 const offline=await readFile(resolve(output,'vpn/offline.html'),'utf8');assert.match(offline,/<link rel="stylesheet" href="\/i18n\/language\.css">/);
});

test('dynamic cabinet support renders the published mail link without Clipboard API or a support script',()=>{
 const source=readFileSync(new URL('../site/vpn/cabinet-ui.js',import.meta.url),'utf8');
 const emailContact=source.match(/function emailContact\(\)\{[^\n]+\}/)?.[0];assert.ok(emailContact);
 const node=(tag,textContent,className)=>({tag,textContent,className,dataset:{},children:[],attributes:{},setAttribute(key,value){this.attributes[key]=value;},append(...children){this.children.push(...children);}});
 // No navigator, window, network or Clipboard API is supplied to the actual renderer.
 const contact=runInNewContext('('+emailContact+')()',{node});
 assert.equal(contact.children.length,1);const link=contact.children[0];assert.equal(link.tag,'a');assert.equal(link.textContent,address);assert.equal(link.href,'mailto:'+address);
 assert.equal(link.attributes['data-fp-no-i18n'],'');
});

test('public and recovery support copy translates without relying on the signed-in app',()=>{
 const window={};runInNewContext(readFileSync(new URL('../site/i18n/en.js',import.meta.url),'utf8'),{window});
 for(const source of ['Личный кабинет','Поможем с VPN','Написать на почту','Не приходит код? Написать на почту','Помощь с оплатой','Telegram — по желанию: подписка и напоминания под рукой. Помощь доступна и по почте.']){
  assert.equal(typeof window.FP_EN[source],'string');assert.doesNotMatch(window.FP_EN[source],/[А-Яа-яЁё]/);
 }
});
