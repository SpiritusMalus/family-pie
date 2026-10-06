import {readFileSync} from 'node:fs';
import {VpnStore} from './store.mjs';import {Accounts} from './auth.mjs';import {TelegramStore,TelegramClient,deliverOne} from './telegram.mjs';
const db=process.env.VPN_DATABASE_PATH,name=process.env.VPN_TELEGRAM_BOT_USERNAME,path=process.env.CREDENTIALS_DIRECTORY+'/bot-token';
if(!db||!name)throw new Error('Telegram service configuration missing');
const client=new TelegramClient(readFileSync(path,'utf8').trim()),store=new VpnStore(db);new Accounts(store);const telegram=new TelegramStore(store);let stopping=false;
process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
try{
 const me=await client.call('getMe');if(!me.is_bot||me.username?.toLowerCase()!==name.toLowerCase())throw new Error('Telegram bot identity mismatch');
 const info=await client.call('getWebhookInfo');if(info.url)throw new Error('Bot already has a webhook; existing integration preserved');
 telegram.recover();let warned=false;
 while(!stopping){try{
  const pending=Boolean(telegram.next());const updates=await client.call('getUpdates',{offset:telegram.offset(),timeout:pending?0:20,limit:50,allowed_updates:['message','my_chat_member']});
  if(!Array.isArray(updates))throw new Error('Invalid Telegram updates');for(const update of updates)telegram.update(update);
  telegram.plan();const sent=await deliverOne(telegram,client);warned=false;if(sent)await new Promise(r=>setTimeout(r,1100));
 }catch(e){if(!warned)console.error('Telegram worker temporarily unavailable; credentials and messages withheld');warned=true;if(e.code===401||e.code===409)throw new Error('Telegram credential or polling conflict');await new Promise(r=>setTimeout(r,5000));}}
}catch{console.error('Telegram worker stopped; check private configuration');process.exitCode=1;}finally{store.close();}
