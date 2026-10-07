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
 cabinet.setPlans([{days:30,priceMinor:1000,devices:1}]);
 const old=cabinet.createOrder(buyer.accountId,30,'old-fixture');
 cabinet.setPlans(plans);
 assert.equal(store.order(buyer.accountId,old.id).price_minor,1000);
 for(const p of plans){const o=cabinet.createOrder(buyer.accountId,p.days,'new-fixture-'+p.days);assert.equal(o.price_minor,p.priceMinor);assert.equal(o.devices,1);}
 assert.equal(users.subscription(legacy.accountId).active,true);
 assert.equal(users.subscription(legacy.accountId).unlimited,1);
 assert.equal(users.subscription(buyer.accountId).active,false);
 assert.equal(store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
 assert.deepEqual(cabinet.plans(),plans);
});
