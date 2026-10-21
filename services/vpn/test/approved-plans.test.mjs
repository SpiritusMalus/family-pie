import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VpnStore} from '../store.mjs';
import {Cabinet} from '../cabinet.mjs';
import {Accounts} from '../auth.mjs';
const plans=JSON.parse(readFileSync(new URL('../approved-plans.json',import.meta.url)));
test('approved period prices preserve previous order amounts and legacy rights',async t=>{
 const store=new VpnStore(':memory:');t.after(()=>store.close());
 const users=new Accounts(store),cabinet=new Cabinet(store);
 const legacy=await users.add({login:'legacy-pricing-fixture',unlimited:true,allowUnlimited:true,panelLogin:'fixture'});
 const buyer=await users.add({login:'pricing-fixture'});
 const previous=[{days:30,priceMinor:30000,devices:0},{days:90,priceMinor:80000,devices:0},{days:180,priceMinor:140000,devices:0},{days:365,priceMinor:250000,devices:0}];
 cabinet.setPlans(previous);
 const old=previous.map(p=>cabinet.createOrder(buyer.accountId,p.days,'old-fixture-'+p.days));
 cabinet.setPlans(plans);
 for(const [i,order] of old.entries()){
  assert.equal(store.order(buyer.accountId,order.id).price_minor,previous[i].priceMinor);
  assert.equal(cabinet.createOrder(buyer.accountId,order.days,'old-fixture-'+order.days).id,order.id);
 }
 for(const p of plans){const o=cabinet.createOrder(buyer.accountId,p.days,'new-fixture-'+p.days);assert.equal(o.price_minor,p.priceMinor);assert.equal(o.devices,0);}
 assert.equal(users.subscription(legacy.accountId).active,true);
 assert.equal(users.subscription(legacy.accountId).unlimited,1);
 assert.equal(users.subscription(buyer.accountId).active,false);
 assert.equal(store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
 assert.deepEqual(cabinet.plans(),plans);
});
