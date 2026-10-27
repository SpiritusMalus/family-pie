import {readFileSync} from 'node:fs';
import {VpnStore} from './store.mjs';import {Accounts} from './auth.mjs';import {TelegramStore,TelegramClient,deliverOne,configureBotMenu} from './telegram.mjs';
import {TelegramSupport,deliverSupportOne} from './telegram-support.mjs';
import {TelegramCommerce,loadTelegramStarsConfig} from './telegram-commerce.mjs';
import {TelegramUI,deliverUiOne,nativeBotCommands,processTelegramUpdates} from './telegram-ui.mjs';
const db=process.env.VPN_DATABASE_PATH,name=process.env.VPN_TELEGRAM_BOT_USERNAME,path=process.env.CREDENTIALS_DIRECTORY+'/bot-token';
if(!db||!name)throw new Error('Telegram service configuration missing');
const client=new TelegramClient(readFileSync(path,'utf8').trim()),store=new VpnStore(db);
const users=new Accounts(store,{publicSubscriptionOrigin:process.env.VPN_SUBSCRIPTION_ORIGIN||null}),telegram=new TelegramStore(store);
const nativeEnabled=process.env.VPN_TELEGRAM_NATIVE_UI==='1';
// Financial events remain active when navigation or new sales are disabled after a rollout.
const commerce=new TelegramCommerce(store,{users,origin:process.env.VPN_PUBLIC_ORIGIN||'https://family-spy.ru',stars:loadTelegramStarsConfig()});
const ui=new TelegramUI(telegram,{commerce,enabled:nativeEnabled,origin:process.env.VPN_PUBLIC_ORIGIN||'https://family-spy.ru'});
telegram.ui=ui;let stopping=false;
process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
try{
 const me=await client.call('getMe');if(!me.is_bot||me.username?.toLowerCase()!==name.toLowerCase())throw new Error('Telegram bot identity mismatch');
 const info=await client.call('getWebhookInfo');if(info.url)throw new Error('Bot already has a webhook; existing integration preserved');
 const supportAccountId=process.env.VPN_TELEGRAM_SUPPORT_ACCOUNT_ID;
 const support=supportAccountId?new TelegramSupport(store,{operatorAccountId:supportAccountId,botId:me.id}):null;
 telegram.support=support;
 support?.recover();telegram.recover();ui?.recover();commerce?.recoverRefunds();let warned=false,menuReady=false,menuRetryAt=0,deliveryIndex=0;
 while(!stopping){try{
  if(!menuReady&&Date.now()>=menuRetryAt){try{await configureBotMenu(client,nativeEnabled?{commands:nativeBotCommands}:{});menuReady=true;}catch{menuRetryAt=Date.now()+60000;console.error('Telegram command menu setup pending; private chat keyboard remains available');}}
  const pending=Boolean(telegram.next()||support?.next()||ui?.next());const updates=await client.call('getUpdates',{offset:telegram.offset(),timeout:pending?0:20,limit:50,allowed_updates:nativeEnabled?['message','my_chat_member','callback_query','pre_checkout_query']:['message','my_chat_member','pre_checkout_query']});
  await processTelegramUpdates(telegram,ui,client,updates);
  telegram.plan();support?.plan();ui?.plan();
  const deliveries=[()=>deliverOne(telegram,client)];
  if(support)deliveries.push(()=>deliverSupportOne(support,client));
  if(ui)deliveries.push(()=>deliverUiOne(ui,client),()=>commerce.deliverRefundOne(client));
  let sent=false;for(let n=0;n<deliveries.length;n++){const index=(deliveryIndex+n)%deliveries.length;if(await deliveries[index]()){sent=true;deliveryIndex=(index+1)%deliveries.length;break;}}
  warned=false;if(sent)await new Promise(r=>setTimeout(r,1100));
 }catch(e){if(!warned)console.error('Telegram worker temporarily unavailable; credentials and messages withheld');warned=true;if(e.code===401||e.code===409)throw new Error('Telegram credential or polling conflict');await new Promise(r=>setTimeout(r,5000));}}
}catch{console.error('Telegram worker stopped; check private configuration');process.exitCode=1;}finally{store.close();}
