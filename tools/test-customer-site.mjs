import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildCustomerSite,canonicalCustomerFlow,publicPlans} from './build-customer-site.mjs';

test('standalone customer artifact excludes portfolio, authenticated pages and payment-recovery copies',async t=>{
  const directory=await mkdtemp(resolve('customer-site/dist-test-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const {output}=await buildCustomerSite(directory);
  for(const path of ['index.html','vpn/index.html','vpn/terms/index.html','sufler/index.html','sufler/setup/index.html','sufler/privacy/index.html','i18n/language.js','vpn/fonts.css'])await access(resolve(output,path));
  for(const path of ['work','preview','rest_lumen','driftora','vpn/cabinet','vpn/admin','sufler/buy'])await assert.rejects(access(resolve(output,path)));
  const home=await readFile(resolve(output,'index.html'),'utf8');
  assert.doesNotMatch(home,/Eugene|Евгений|LinkedIn|SpiritusMalus|portrait/);
  const sufler=await readFile(resolve(output,'sufler/index.html'),'utf8');
  assert.doesNotMatch(sufler,/fp-social|linkedin\.com/);
  assert.match(sufler,/https:\/\/family-spy\.ru\/sufler\//);
  assert.match(sufler,/releases\/download\/sufler-v0\.2\.0\//);
  for(const route of ['sufler/index.html','sufler/setup/index.html','sufler/terms/index.html','sufler/privacy/index.html']) {
    const html=await readFile(resolve(output,route),'utf8');
    assert.match(html,/<a class="brand"[^>]*>family-spy <span>\/ Sufler<\/span>/,route);
    assert.doesNotMatch(html,/<a class="brand"[^>]*>family-pie/,route);
  }
  assert.match(home,/Сначала|Поможем с подключением и настройкой/);
  assert.doesNotMatch(home,/100%|полная анонимность|вернём деньги|uptime|24\/7/i);
});
test('artifact rebuild refuses to erase unmanaged files or the portfolio source',async t=>{
  const directory=await mkdtemp(resolve('customer-site/dist-test-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const {writeFile}=await import('node:fs/promises');await writeFile(resolve(directory,'owner.txt'),'Keep this file');
  await assert.rejects(buildCustomerSite(directory),/unmanaged/);
  assert.equal(await readFile(resolve(directory,'owner.txt'),'utf8'),'Keep this file');
  await assert.rejects(buildCustomerSite(resolve('site')),/unsafe/);
});
test('customer-flow aliases retain only intended account/payment URL boundaries',()=>{
  for(const path of ['/vpn/cabinet','/vpn/cabinet/auth/','/vpn/admin/','/sufler/buy/','/sufler/buy/done/'])assert.equal(canonicalCustomerFlow(path),true,path);
  for(const path of ['/vpn/','/vpn/cabinet-evil','/sufler/buyer','/sufler/setup/','/vpn/api/login'])assert.equal(canonicalCustomerFlow(path),false,path);
});
test('plan proxies are a fixed public read-only allowlist',()=>{
  assert.deepEqual(Object.keys(publicPlans),['/public-plans/vpn','/public-plans/sufler']);
  assert.equal(publicPlans['/public-plans/vpn'],'https://family-pie.ru/vpn/api/plans');
  assert.equal(publicPlans['/public-plans/sufler'],'https://hub.146-103-120-137.sslip.io/sufler-license/billing/plan');
});
