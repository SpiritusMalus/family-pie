import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateStarsPlans,describeStarsPlans} from '../telegram-pricing.mjs';
import {TelegramCommerce,loadTelegramStarsConfig} from '../telegram-commerce.mjs';
import {VpnStore} from '../store.mjs';
import {Accounts} from '../auth.mjs';
import {Cabinet} from '../cabinet.mjs';
import {TelegramStore} from '../telegram.mjs';
import {TelegramUI} from '../telegram-ui.mjs';

// These are proposed synthetic catalogue values, not approved production prices.
function purchase(commerce,chatId,days,key){const offer=commerce.preparePurchase(chatId,days,key);commerce.acceptPurchase(chatId,offer.token);return commerce.invoice(chatId,days,key,offer.token);}
const candidate=[{days:30,stars:350},{days:90,stars:900},{days:180,stars:1600},{days:365,stars:2800}];
function fixture(t,{plans=candidate,enabled=true}={}){
 const store=new VpnStore(':memory:');t.after(()=>store.close());const users=new Accounts(store),telegram=new TelegramStore(store);
 const commerce=new TelegramCommerce(store,{users,stars:{enabled,approved:enabled,plans}});commerce.ensure(1001,{acceptedTerms:true});
 const ui=new TelegramUI(telegram,{commerce,enabled:true});
 return {store,users,commerce,cabinet:new Cabinet(store),render:()=>ui.render({chat_id:'1001',view:'plans',payload:'{}'}).data};
}

test('catalogue sorts copied records and requires a strictly improving daily price for every longer listed term',()=>{
 const unsorted=[candidate[3],candidate[0],candidate[2],candidate[1]].map(p=>({...p})),before=structuredClone(unsorted);
 const sorted=validateStarsPlans(unsorted);assert.deepEqual(sorted,candidate);assert.deepEqual(unsorted,before);assert.notEqual(sorted[0],unsorted[1]);assert.ok(Object.isFrozen(sorted)&&sorted.every(Object.isFrozen));
 for(const plans of [[{days:30,stars:300},{days:90,stars:900}],[{days:30,stars:300},{days:90,stars:901}],[{days:30,stars:350},{days:90,stars:900},{days:180,stars:1800}],[{days:90,stars:900},{days:365,stars:3650}]])assert.throws(()=>validateStarsPlans(plans),/less per day/);
 assert.deepEqual(validateStarsPlans([{days:90,stars:1},{days:30,stars:1}]),[{days:30,stars:1},{days:90,stars:1}]);
});

test('empty and single catalogues are safe; malformed and unsafe explicit values are rejected',()=>{
 assert.deepEqual(validateStarsPlans(),[]);assert.deepEqual(validateStarsPlans([]),[]);assert.deepEqual(validateStarsPlans([{days:365,stars:1}]),[{days:365,stars:1}]);
 for(const plans of [null,{},[null],[{days:'30',stars:1}],[{days:31,stars:1}],[{days:30,stars:0}],[{days:30,stars:1.5}],[{days:30,stars:1_000_001}],[{days:30,stars:Number.MAX_SAFE_INTEGER}],[{days:30,stars:NaN}],[{days:30,stars:1},{days:30,stars:2}]])assert.throws(()=>validateStarsPlans(plans),/Invalid Stars/);
});

test('comparisons use actual365 days, honest fractional normalization and approximate savings versus the30-day base',()=>{
 const descriptions=describeStarsPlans(candidate);assert.deepEqual(descriptions.map(p=>p.per30Days),['350','300','≈ 266,67','≈ 230,14']);
 assert.deepEqual(descriptions.map(p=>p.savings),[null,'≈ 14,3%','≈ 23,8%','≈ 34,2%']);
 assert.equal(describeStarsPlans([{days:30,stars:400},{days:90,stars:900}])[1].savings,'25%');
 const noBase=describeStarsPlans([{days:180,stars:1600},{days:90,stars:900}]);assert.ok(noBase.every(p=>p.savings===null));assert.deepEqual(noBase.map(p=>p.per30Days),['300','≈ 266,67']);
 assert.equal(describeStarsPlans([{days:365,stars:1}])[0].per30Days,'≈ 0,08');
});

test('tiny discounts stay positive without exaggerated rounding and near-limit integer prices remain exact',()=>{
 const tiny=describeStarsPlans([{days:30,stars:333334},{days:90,stars:1000000}]);assert.equal(tiny[1].savings,'<0,1%');assert.equal(tiny[1].per30Days,'≈ 333333,33');
 assert.throws(()=>validateStarsPlans([{days:30,stars:333333},{days:90,stars:999999}]),/less per day/);
});

test('invalid explicit catalogue is rejected before commerce schema or recovery mutations even with selling flags off',()=>{
 let effects=0;const store={clock:Date.now,db:{exec(){effects++;throw new Error('DB should not be touched');}}};
 for(const plans of [null,[{days:30,stars:300},{days:90,stars:900}]])assert.throws(()=>new TelegramCommerce(store,{users:{},stars:{enabled:false,approved:false,plans}}),/Stars/);
 assert.equal(effects,0);
});

test('explicit config files are validated independently of enablement and never infer RUB conversion',t=>{
 assert.deepEqual(loadTelegramStarsConfig({}),{enabled:false,approved:false,plans:[]});
 const dir=mkdtempSync(join(tmpdir(),'stars-pricing-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=join(dir,'plans.json');
 for(const value of [{},null,{plans:[{days:30,stars:300},{days:90,stars:900}]}]){writeFileSync(file,JSON.stringify(value));assert.throws(()=>loadTelegramStarsConfig({VPN_TELEGRAM_STARS_PLANS_FILE:file}),/Stars/);}
 writeFileSync(file,JSON.stringify({plans:[candidate[1],candidate[0]]}));const config=loadTelegramStarsConfig({VPN_TELEGRAM_STARS_PLANS_FILE:file});assert.equal(config.enabled,false);assert.equal(config.approved,false);assert.deepEqual(config.plans,candidate.slice(0,2));
});

test('catalogue replacement affects new invoices while replayed and persisted orders retain their original price',t=>{
 const f=fixture(t),first=purchase(f.commerce,1001,30,'pricing-existing-order');
 const changed=new TelegramCommerce(f.store,{users:f.users,stars:{enabled:true,approved:true,plans:[{days:90,stars:950},{days:30,stars:400}]}});
 assert.deepEqual(purchase(changed,1001,30,'pricing-existing-order'),first);assert.equal(purchase(changed,1001,30,'pricing-new-order').prices[0].amount,400);
 const rows=f.store.db.prepare('SELECT payment_amount FROM orders ORDER BY payment_amount').all();assert.deepEqual(rows.map(p=>p.payment_amount),[350,400]);assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
 assert.throws(()=>new TelegramCommerce(f.store,{users:f.users,stars:{plans:[{days:30,stars:400},{days:90,stars:1200}]}}),/less per day/);assert.deepEqual(f.store.db.prepare('SELECT payment_amount FROM orders ORDER BY payment_amount').all().map(p=>p.payment_amount),[350,400]);
});

test('main bot does not turn an enabled Stars catalogue into RUB prices or new invoice buttons',t=>{
 const f=fixture(t,{plans:[candidate[3],candidate[1],candidate[0],candidate[2]]}),view=f.render();
 assert.match(view.text,/Тарифы сейчас недоступны/);assert.ok(!view.reply_markup.inline_keyboard.flat().some(button=>button.text.includes('⭐')));
 assert.equal(f.store.db.prepare("SELECT count(*) n FROM telegram_ui_callbacks WHERE action IN ('invoice','checkout')").get().n,0);
 assert.deepEqual(f.commerce.plans().plans,candidate);assert.equal(f.store.db.prepare('SELECT count(*) n FROM orders').get().n,0);
});

test('persisted RUB choices remain available regardless of empty or disabled Stars catalogue',t=>{
 for(const options of [{plans:[]},{enabled:false},{plans:[{days:90,stars:900}]}]){
  const f=fixture(t,options);f.cabinet.setPlans([{days:90,priceMinor:76500,devices:0}]);const view=f.render();
  assert.equal(view.reply_markup.inline_keyboard[0][0].text,'90 дней · 765 ₽');assert.match(view.text,/на сайте через ЮKassa/);assert.doesNotMatch(view.text,/⭐|экономия|за 30 дней/);
 }
});

test('legacy Stars comparison remains exact without being injected into the current RUB purchase view',t=>{
 const f=fixture(t,{plans:[{days:30,stars:333334},{days:90,stars:1000000}]});f.cabinet.setPlans([{days:30,priceMinor:30000,devices:0}]);
 assert.equal(describeStarsPlans(f.commerce.plans().plans)[1].savings,'<0,1%');assert.doesNotMatch(f.render().text,/0,1%|1000000|Stars|⭐/);
});
