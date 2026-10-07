import { createServer } from 'node:http';
import { VpnStore } from './store.mjs';
import { Accounts } from './auth.mjs';
import { TelegramStore } from './telegram.mjs';
import { Cabinet } from './cabinet.mjs';
import { Billing,billingConfig } from './billing.mjs';
import { randomBytes } from 'node:crypto';
import { Passkeys } from './passkeys.mjs';
import QRCode from 'qrcode';
import { GoogleLogin,googleConfig as readGoogleConfig,googleReturnPath } from './google.mjs';
import {EmailLogin,smtpSender} from './email.mjs';
import {PushNotifications} from './push.mjs';
export function createApp({store,origin='https://family-pie.ru',secure=true,revision='development',botUsername='',paymentConfig={},googleConfig={},sendEmail=null,pushConfig={}}){
 const users=new Accounts(store),attempts=new Map();let passwordOperations=0;
 const cabinet=new Cabinet(store),billing=new Billing(store,paymentConfig);
 const passkeys=new Passkeys(store,users,origin);
 const google=new GoogleLogin(store,users,{...googleConfig,origin});
 const emailLogin=new EmailLogin(store,users,{send:sendEmail});
 const push=new PushNotifications(store,pushConfig);
 const savedPlans=cabinet.plans();if(savedPlans.length)store.plans=new Map(savedPlans.map(p=>[String(p.days),Object.freeze({...p})]));
 const telegram=new TelegramStore(store),botReady=/^[A-Za-z0-9_]{5,32}$/.test(botUsername)&&/bot$/i.test(botUsername);
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 const cookie=(res,token)=>res.setHeader('Set-Cookie',`vpn_session=${token}; Path=/vpn/; HttpOnly; SameSite=Strict; ${secure?'Secure; ':''}Max-Age=${token?43200:0}`);
 const token=req=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('vpn_session='))?.slice(12);
 const recent=s=>{if(!users.db.prepare('SELECT 1 FROM session_auth WHERE token_hash=? AND verified_at>?').get(s.token_hash,Date.now()-300000))throw new Error('Повтори вход перед изменением способов входа');};
 const server=createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,origin).pathname;
   if(path==='/vpn/api/health'&&req.method==='GET')return send(res,200,{service:'family-vpn-cabinet',revision});
   if(path==='/vpn/api/plans'&&req.method==='GET')return send(res,200,{plans:[...store.plans.values()],available:billing.ready()&&store.plans.size>0,testMode:billing.config.testMode});
   if(path==='/vpn/api/auth-options'&&req.method==='GET')return send(res,200,{google:google.ready(),email:Boolean(sendEmail),passkey:true,password:true,registration:true});
   if(path==='/vpn/api/google/start'&&req.method==='GET'){const q=new URL(req.url,origin).searchParams,next=googleReturnPath(q.get('next'),origin),existing=users.session(token(req));if(!google.ready()){res.writeHead(302,{'Location':'/vpn/cabinet/auth/?google_error=1&next='+encodeURIComponent(next),'Cache-Control':'no-store'});return res.end();}if(existing?.identity.must_change)return send(res,403,{error:'Сначала смени временный пароль'});if(existing){try{recent(existing);}catch{res.writeHead(302,{'Location':'/vpn/cabinet/auth/?reauth=1&next='+encodeURIComponent(next),'Cache-Control':'no-store'});return res.end();}}const s=google.start(existing,next);res.writeHead(302,{'Location':s.url,'Cache-Control':'no-store','Set-Cookie':`vpn_google=${s.state}; Path=/vpn/api/google/; HttpOnly; SameSite=Lax; ${secure?'Secure; ':''}Max-Age=300`});return res.end();}
   if(path==='/vpn/api/google/callback'&&req.method==='GET'){const q=new URL(req.url,origin).searchParams,c=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('vpn_google='))?.slice(11),next=google.returnPath(q.get('state'),c);try{const s=await google.finish(q.get('state'),c,q.get('code'));cookie(res,s.token);res.writeHead(302,{'Location':s.identity.role==='admin'&&s.next==='/vpn/cabinet/'?'/vpn/admin/':s.next,'Cache-Control':'no-store'});return res.end();}catch{res.writeHead(302,{'Location':'/vpn/cabinet/auth/?google_error=1&next='+encodeURIComponent(next),'Cache-Control':'no-store'});return res.end();}}
   if(path==='/vpn/api/passkeys/login/options'&&req.method==='POST'){
    if(req.headers.origin!==origin)return send(res,403,{error:'Источник запроса не разрешён'});return send(res,200,await passkeys.options());
   }
   const webhook=path==='/vpn/api/billing/webhook'&&req.method==='POST';
   const mutation=req.method!=='GET';
   if(mutation&&!webhook&&req.headers.origin!==origin)return send(res,403,{error:'Источник запроса не разрешён'});
   if(path==='/vpn/api/support/attachment'&&mutation&&!users.session(token(req)))return send(res,401,{error:'Войди в аккаунт'});
   let body={};
   if(mutation){if(!String(req.headers['content-type']).startsWith('application/json'))return send(res,415,{error:'Ожидается JSON'});
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>(path==='/vpn/api/support/attachment'?1500000:32768))return send(res,413,{error:'Слишком большой запрос'});}try{body=JSON.parse(raw);}catch{return send(res,400,{error:'Некорректный запрос'});}}
   if(webhook){const key='webhook',now=Date.now(),limit=attempts.get(key)||{count:0,until:now+60000};if(limit.until<now){limit.count=0;limit.until=now+60000;}if(limit.count++>=30)return send(res,429,{error:'Повтори позже'});attempts.set(key,limit);try{await billing.webhook(body.event,body.object?.id);return send(res,200,{ok:true});}catch{return send(res,503,{error:'Проверка платежа недоступна'});}}
   if(path==='/vpn/api/passkeys/login'&&req.method==='POST'){const s=await passkeys.login(body.challengeId,body.response);cookie(res,s.token);return send(res,200,{user:s.identity,csrf:s.csrf});}
   if(path==='/vpn/api/email/login/request'&&req.method==='POST')return send(res,200,await emailLogin.issue(body.email));
   if(path==='/vpn/api/email/login/confirm'&&req.method==='POST'){const s=emailLogin.confirm(body.challengeId,body.code);cookie(res,s.token);return send(res,200,{user:s.identity,csrf:s.csrf});}
   if(path==='/vpn/api/register'&&req.method==='POST'){
    if(body.acceptedTerms!==true)return send(res,400,{error:'Подтверди условия и обработку данных'});
    if(passwordOperations>=1)return send(res,429,{error:'Повтори позже'});const key='register:'+String(body.login).slice(0,80),now=Date.now(),limit=attempts.get(key)||{count:0,until:now+600000};if(limit.until<now){limit.count=0;limit.until=now+600000;}if(limit.count++>=3)return send(res,429,{error:'Повтори позже'});attempts.set(key,limit);passwordOperations++;
    try{const login=users.normalize(body.login);if(!/^[a-z0-9][a-z0-9_.-]{2,39}$/.test(login))return send(res,400,{error:'Логин:3–40 латинских букв, цифр, точек или дефисов'});const result=await users.add({login,password:body.password});if(!result.created)return send(res,409,{error:'Такой логин уже занят'});users.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(result.accountId);cabinet.attribute(result.accountId,body.ref);const session=users.newSession(result.accountId);cookie(res,session.token);return send(res,201,{user:session.identity,csrf:session.csrf});}finally{passwordOperations--;}
   }
   if(path==='/vpn/api/login'&&req.method==='POST'){
    const key=String(body.login).trim().toLowerCase(),now=Date.now();
    for(const[k,v]of attempts)if(v.until<now)attempts.delete(k);
    const limit=attempts.get(key)||{count:0,until:now+600_000};
    if(typeof body.login!=='string'||typeof body.password!=='string'||!body.login.trim()||body.login.length>80||!body.password||body.password.length>128)return send(res,400,{error:'Укажи логин и пароль'});
    if(limit.count>=10||attempts.size>=10000||passwordOperations>=1)return send(res,429,{error:'Слишком много попыток. Повтори позже.'});
    limit.count++;attempts.set(key,limit);passwordOperations++;
    let session;try{session=await users.login(body.login,body.password);}finally{passwordOperations--;}
    if(!session)return send(res,401,{error:'Неверный логин или пароль'});
    attempts.delete(key);cookie(res,session.token);return send(res,200,{user:session.identity,csrf:session.csrf});
   }
   const session=users.session(token(req));if(!session)return send(res,401,{error:'Войди в аккаунт'});
   const id=session.account_id;
   if(mutation&&req.headers['x-csrf-token']!==session.csrf)return send(res,403,{error:'Обнови страницу и повтори'});
   if(path==='/vpn/api/me'&&req.method==='GET')return send(res,200,{user:session.identity,csrf:session.csrf,subscription:session.identity.must_change?null:users.subscription(id)});
   if(path==='/vpn/api/logout'&&req.method==='POST'){users.logout(token(req));cookie(res,'');return send(res,200,{ok:true});}
   if(path==='/vpn/api/password'&&req.method==='POST'){
    const key='pw:'+id,now=Date.now(),limit=attempts.get(key)||{count:0,until:now+600_000};
    if(limit.until<now){limit.count=0;limit.until=now+600_000;}
    if(limit.count>=10||passwordOperations>=1)return send(res,429,{error:'Повтори позже'});limit.count++;attempts.set(key,limit);passwordOperations++;
    try{const updated=await users.changePassword(id,body.current,body.next);cookie(res,updated.token);return send(res,200,{ok:true,csrf:updated.csrf});}finally{passwordOperations--;}
   }
   if(session.identity.must_change)return send(res,403,{error:'Сначала смени временный пароль',mustChange:true});
   const admin=session.identity.role==='admin';
   if(mutation&&['/vpn/api/email','/vpn/api/email/confirm','/vpn/api/google','/vpn/api/passkeys','/vpn/api/passkeys/options'].includes(path))recent(session);
   if(path==='/vpn/api/push'&&req.method==='GET')return send(res,200,push.state(id));
   if(path==='/vpn/api/push'&&req.method==='POST')return send(res,201,push.subscribe(id,body.subscription));
   if(path==='/vpn/api/push'&&req.method==='DELETE'){push.disconnect(id,body.id);return send(res,200,{ok:true});}
   if(path==='/vpn/api/email'&&req.method==='GET')return send(res,200,emailLogin.state(id));
   if(path==='/vpn/api/email'&&req.method==='POST')return send(res,200,await emailLogin.issue(body.email,session));
   if(path==='/vpn/api/email/confirm'&&req.method==='POST')return send(res,200,emailLogin.confirm(body.challengeId,body.code,session));
   if(path==='/vpn/api/email'&&req.method==='DELETE'){emailLogin.disconnect(id);return send(res,200,{ok:true});}
   if(path==='/vpn/api/password/set'&&req.method==='POST'){const s=await users.setPassword(id,session.token_hash,body.next);cookie(res,s.token);return send(res,200,{ok:true,csrf:s.csrf});}
   if(path==='/vpn/api/google'&&req.method==='GET')return send(res,200,google.state(id));
   if(path==='/vpn/api/google'&&req.method==='DELETE'){google.unlink(id);return send(res,200,{ok:true});}
   if(path==='/vpn/api/passkeys'&&req.method==='GET')return send(res,200,{passkeys:passkeys.list(id)});
   if(path==='/vpn/api/passkeys/options'&&req.method==='POST')return send(res,200,await passkeys.options(session));
   if(path==='/vpn/api/passkeys'&&req.method==='POST')return send(res,201,{passkeys:await passkeys.register(session,body.challengeId,body.response,body.name)});
   if(path==='/vpn/api/passkeys'&&req.method==='DELETE'){passkeys.remove(id,body.id);return send(res,200,{ok:true});}
   if(path==='/vpn/api/subscription/qr'&&req.method==='GET'){const sub=users.subscription(id);if(!sub.active||sub.sync_state!=='synced'||!sub.profile_url)return send(res,403,{error:'Нет активного подключения'});const svg=await QRCode.toString(sub.profile_url,{type:'svg',errorCorrectionLevel:'M',margin:2,width:240});res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; sandbox"});return res.end(svg);}
   if(path==='/vpn/api/friends/qr'&&req.method==='GET'){const svg=await QRCode.toString(cabinet.friends(id).url,{type:'svg',margin:2,width:240});res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'no-store'});return res.end(svg);}
   if(path==='/vpn/api/profile'&&req.method==='GET')return send(res,200,{profile:cabinet.profile(id)});
   if(path==='/vpn/api/profile'&&req.method==='PATCH')return send(res,200,{profile:cabinet.updateProfile(id,body)});
   if(path==='/vpn/api/sessions'&&req.method==='GET')return send(res,200,{sessions:users.db.prepare('SELECT token_hash id,expires FROM sessions WHERE account_id=? AND expires>? ORDER BY expires DESC').all(id,Date.now()).map(s=>({...s,current:s.id===session.token_hash}))});
   if(path==='/vpn/api/sessions'&&req.method==='DELETE'){users.db.prepare('DELETE FROM sessions WHERE account_id=? AND token_hash<>?').run(id,session.token_hash);return send(res,200,{ok:true});}
   if(path==='/vpn/api/friends'&&req.method==='GET')return send(res,200,cabinet.friends(id));
   if(path==='/vpn/api/friends/withdraw'&&req.method==='POST')return send(res,201,cabinet.withdraw(id,body.amount));
   if(path==='/vpn/api/orders'&&req.method==='GET')return send(res,200,{orders:cabinet.orders(id)});
   if(path==='/vpn/api/promo'&&req.method==='POST'){const p=cabinet.promo(body.code);return send(res,200,{code:p.code,percent:p.percent});}
   if(path==='/vpn/api/checkout'&&req.method==='POST'){
    if(admin)return send(res,409,{error:'Для покупки используй отдельный пользовательский аккаунт'});
    if(users.subscription(id).deleted)return send(res,409,{error:'Подписка отключена. Сначала напиши в поддержку'});
    if(users.subscription(id).allow_unlimited)return send(res,409,{error:'У тебя бессрочный доступ. Оплачивать продление не нужно'});
    if(!billing.ready())return send(res,503,{error:'Оплата временно недоступна'});
    if(typeof body.email!=='string'||body.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))return send(res,400,{error:'Укажи email для чека'});
    if(!users.db.prepare('SELECT 1 FROM orders WHERE account_id=? AND request_key=?').get(id,body.requestKey)&&users.db.prepare("SELECT count(*) n FROM orders WHERE account_id=? AND state='pending' AND created_at>?").get(id,Date.now()-24*3600000).n>=5)return send(res,429,{error:'Сначала заверши или дождись отмены предыдущих платежей'});
    cabinet.createOrder(id,body.days,body.requestKey,body.promo);return send(res,200,await billing.checkout(id,body.days,body.requestKey,body.email));
   }
   const orderMatch=path.match(/^\/vpn\/api\/orders\/([a-f0-9-]+)\/check$/);if(orderMatch&&req.method==='POST'){const o=await billing.check(id,orderMatch[1]);return send(res,200,{order:{id:o.id,state:o.state},subscription:users.subscription(id)});}
   if(path==='/vpn/api/support'&&req.method==='GET')return send(res,200,{threads:cabinet.threads(id)});
   if(path==='/vpn/api/support'&&req.method==='POST')return send(res,201,{thread:cabinet.createThread(id,body.subject,body.message,body.requestKey)});
   const threadMatch=path.match(/^\/vpn\/api\/(admin\/)?support\/([a-f0-9-]+)$/);if(threadMatch){if(threadMatch[1]&&!admin)return send(res,403,{error:'Только для администратора'});const privileged=Boolean(threadMatch[1]);if(req.method==='GET')return send(res,200,{thread:cabinet.thread(threadMatch[2],id,privileged),messages:cabinet.messages(threadMatch[2],id,privileged)});if(req.method==='POST')return send(res,201,cabinet.reply(threadMatch[2],id,body.message,privileged,body.requestKey));if(req.method==='PATCH'){cabinet.closeThread(threadMatch[2],id,body.closed,privileged);return send(res,200,{ok:true});}}
   if(path==='/vpn/api/support/attachment'&&req.method==='POST')return send(res,201,cabinet.attachment(body.messageId,id,body.name,body.mime,body.data,admin));
   const fileMatch=path.match(/^\/vpn\/api\/support\/files\/([a-f0-9-]+)$/);if(fileMatch&&req.method==='GET'){const f=cabinet.file(fileMatch[1],id,admin);res.writeHead(200,{'Content-Type':f.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"});return res.end(Buffer.from(f.data));}
   if(path==='/vpn/api/news'&&req.method==='GET')return send(res,200,{posts:cabinet.posts(id)});
   if(path==='/vpn/api/news/read'&&req.method==='POST'){cabinet.readPost(id,body.id);return send(res,200,{ok:true});}
   if(path==='/vpn/api/diagnostics'&&req.method==='GET'){const peer=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();return send(res,200,{time:Date.now(),exitRequest:!process.env.VPN_EXIT_IPS||!peer||['127.0.0.1','::1'].includes(peer)?null:process.env.VPN_EXIT_IPS.split(',').includes(peer)});}
   if(path==='/vpn/api/diagnostics/download'&&req.method==='GET'){const data=randomBytes(262144);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-store'});return res.end(data);}
   if(path==='/vpn/api/diagnostics/upload'&&req.method==='POST')return send(res,200,{received:typeof body.data==='string'?Buffer.byteLength(body.data):0});
   if(path==='/vpn/api/telegram'&&req.method==='GET')return send(res,200,{available:botReady,...telegram.state(id,session.token_hash)});
   if(path==='/vpn/api/telegram'&&req.method==='DELETE'){telegram.disconnect(id);return send(res,200,{ok:true});}
   if(path==='/vpn/api/telegram/link'&&req.method==='POST'){
    if(!botReady)return send(res,503,{error:'Telegram-бот ещё подключается'});
    return send(res,200,{url:`https://t.me/${botUsername}?start=bind_${telegram.issue(id,session.token_hash)}`});
   }
   if(path==='/vpn/api/telegram/confirm'&&req.method==='POST'){if(!botReady)return send(res,503,{error:'Telegram-бот ещё подключается'});telegram.confirm(id,session.token_hash);return send(res,200,{ok:true});}
   if(path.startsWith('/vpn/api/admin/')){
    if(session.identity.role!=='admin')return send(res,403,{error:'Только для администратора'});
    if(path==='/vpn/api/admin/plans'&&req.method==='PUT')return send(res,200,{plans:cabinet.setPlans(body.plans)});
    if(path==='/vpn/api/admin/orders'&&req.method==='GET')return send(res,200,{orders:users.db.prepare('SELECT o.id,o.account_id,o.days,o.price_minor,o.state,o.created_at,i.login FROM orders o JOIN identities i USING(account_id) ORDER BY o.created_at DESC LIMIT 100').all()});
    if(path==='/vpn/api/admin/refund'&&req.method==='POST'){const o=users.db.prepare('SELECT account_id FROM orders WHERE id=?').get(body.orderId);if(!o)throw new Error('Заказ не найден');return send(res,200,await billing.refund(o.account_id,body.orderId,body.requestKey));}
    if(path==='/vpn/api/admin/referrals'&&req.method==='GET')return send(res,200,cabinet.referralPolicy());
    if(path==='/vpn/api/admin/referrals'&&req.method==='PUT')return send(res,200,cabinet.setReferralPolicy(body));
    if(path==='/vpn/api/admin/withdrawals'&&req.method==='GET')return send(res,200,{withdrawals:users.db.prepare('SELECT w.*,i.login FROM withdrawals w JOIN identities i USING(account_id) ORDER BY created_at DESC LIMIT 100').all()});
    if(path==='/vpn/api/admin/withdrawals'&&req.method==='PATCH'){cabinet.settleWithdrawal(id,body.id,body.state,body.proof);return send(res,200,{ok:true});}
    if(path==='/vpn/api/admin/promos'&&req.method==='POST')return send(res,201,cabinet.setPromo(body));
    if(path==='/vpn/api/admin/promos'&&req.method==='GET')return send(res,200,{promos:users.db.prepare('SELECT * FROM promo_codes ORDER BY expires DESC').all()});
    if(path==='/vpn/api/admin/support'&&req.method==='GET')return send(res,200,{threads:cabinet.threads(id,true)});
    if(path==='/vpn/api/admin/news'&&req.method==='GET')return send(res,200,{posts:cabinet.posts(id,true)});
    if(path==='/vpn/api/admin/news'&&req.method==='POST')return send(res,201,cabinet.savePost(body));
    if(path==='/vpn/api/admin/users'&&req.method==='GET')return send(res,200,{users:users.list()});
    if(path==='/vpn/api/admin/users'&&req.method==='POST'){
     const key='pw:'+id,now=Date.now(),limit=attempts.get(key)||{count:0,until:now+600_000};
    if(limit.until<now){limit.count=0;limit.until=now+600_000;}
    if(limit.count>=10||passwordOperations>=1)return send(res,429,{error:'Повтори позже'});limit.count++;attempts.set(key,limit);passwordOperations++;
     try{if(body.unlimited!==false||!Number.isSafeInteger(body.expiresAt)||body.expiresAt<=Date.now())return send(res,400,{error:'Для нового пользователя выбери дату окончания в будущем'});
     const result=await users.add({login:body.login,actor:id,expiresAt:body.expiresAt,unlimited:body.unlimited,devices:body.devices||0});if(!result.created)return send(res,409,{error:'Такой логин уже есть'});
      return send(res,201,{accountId:result.accountId,login:result.login,temporaryPassword:result.password});}finally{passwordOperations--;}
    }
    const match=path.match(/^\/vpn\/api\/admin\/users\/([a-f0-9-]+)$/);
    if(match&&['PATCH','DELETE'].includes(req.method))return send(res,200,{subscription:users.edit(id,match[1],req.method==='DELETE'?{deleted:true,enabled:false}:body)});
   }
   return send(res,404,{error:'Раздел не найден'});
  }catch(e){send(res,400,{error:e.message==='Unlimited access is reserved for existing users'?'Новым пользователям нужна подписка с датой окончания':['Wrong current password','Choose a new password'].includes(e.message)?'Проверь текущий пароль и выбери новый':e.message.startsWith('Password must')?'Пароль должен содержать от12 до128 символов':/[А-Яа-я]/.test(e.message)?e.message.slice(0,240):'Запрос не выполнен. Проверь данные.'});}
 });server.headersTimeout=10000;server.requestTimeout=15000;
 return {server,users,cabinet,billing,passkeys,google,emailLogin,push};
}
if(process.argv[1]?.endsWith('/server.mjs')){
 if(!process.env.VPN_DATABASE_PATH)throw new Error('Private database path required');
 const store=new VpnStore(process.env.VPN_DATABASE_PATH);
 const pushConfig=process.env.VPN_PUSH_CONFIG_FILE?JSON.parse((await import('node:fs')).readFileSync(process.env.VPN_PUSH_CONFIG_FILE,'utf8')):{};
 const {server,billing,push}=createApp({store,revision:process.env.VPN_REVISION||'unknown',botUsername:process.env.VPN_TELEGRAM_BOT_USERNAME||'',paymentConfig:billingConfig(),googleConfig:readGoogleConfig(),sendEmail:smtpSender(),pushConfig});
 const reconcile=setInterval(()=>{billing.reconcile().catch(()=>{});push.tick().catch(()=>{});},30000);reconcile.unref();
 server.listen(Number(process.env.VPN_PORT)||8796,'127.0.0.1');
 process.on('SIGTERM',()=>server.close(()=>{store.close();process.exit(0);}));
}
