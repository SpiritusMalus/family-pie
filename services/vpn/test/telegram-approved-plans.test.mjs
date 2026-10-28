import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadTelegramStarsConfig} from '../telegram-commerce.mjs';

test('owner-approved Stars catalogue keeps its exact one-time amounts and increasing period discounts',()=>{
 const path=fileURLToPath(new URL('../approved-stars-plans.json',import.meta.url));
 const document=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(document.currency,'XTR');assert.equal(document.billing,'one-time');
 const expected=[{days:30,stars:300},{days:90,stars:800},{days:180,stars:1500},{days:365,stars:2700}];
 assert.deepEqual(document.plans,expected);
 const configured=loadTelegramStarsConfig({VPN_TELEGRAM_STARS_PLANS_FILE:path,VPN_TELEGRAM_STARS_ENABLED:'1',VPN_TELEGRAM_STARS_APPROVED:'1'});
 assert.deepEqual(configured.plans,expected);assert.equal(configured.enabled,true);assert.equal(configured.approved,true);
 for(let i=1;i<configured.plans.length;i++)assert.ok(configured.plans[i-1].stars*configured.plans[i].days>configured.plans[i].stars*configured.plans[i-1].days);
 assert.equal(loadTelegramStarsConfig({VPN_TELEGRAM_STARS_PLANS_FILE:path}).enabled,false);
});
