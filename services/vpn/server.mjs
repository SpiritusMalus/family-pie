import { createServer } from 'node:http';
import { VpnStore } from './store.mjs';
import { Accounts } from './auth.mjs';
import { TelegramStore } from './telegram.mjs';
export function createApp({store,origin='https://family-pie.ru',secure=true,revision='development',botUsername=''}){
 const users=new Accounts(store),attempts=new Map();let passwordOperations=0;let globalAttempts={count:0,until:0};
 const telegram=new TelegramStore(store),botReady=/^[A-Za-z0-9_]{5,32}$/.test(botUsername)&&/bot$/i.test(botUsername);
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 const cookie=(res,token)=>res.setHeader('Set-Cookie',`vpn_session=${token}; Path=/vpn/; HttpOnly; SameSite=Strict; ${secure?'Secure; ':''}Max-Age=${token?43200:0}`);
 const token=req=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('vpn_session='))?.slice(12);
 const server=createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,origin).pathname;
   if(path==='/vpn/api/health'&&req.method==='GET')return send(res,200,{service:'family-vpn-cabinet',revision});
   const mutation=req.method!=='GET';
   if(mutation&&req.headers.origin!==origin)return send(res,403,{error:'Источник запроса не разрешён'});
   let body={};
   if(mutation){if(!String(req.headers['content-type']).startsWith('application/json'))return send(res,415,{error:'Ожидается JSON'});
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16384)return send(res,413,{error:'Слишком большой запрос'});}try{body=JSON.parse(raw);}catch{return send(res,400,{error:'Некорректный запрос'});}}
   if(path==='/vpn/api/login'&&req.method==='POST'){
    const key=String(body.login).trim().toLowerCase(),now=Date.now();
    for(const[k,v]of attempts)if(v.until<now)attempts.delete(k);
    if(globalAttempts.until<now)globalAttempts={count:0,until:now+600_000};
    const limit=attempts.get(key)||{count:0,until:now+600_000};
    if(globalAttempts.count>=100||limit.count>=10||attempts.size>=10000||passwordOperations>=1)return send(res,429,{error:'Слишком много попыток. Повтори позже.'});
    globalAttempts.count++;limit.count++;attempts.set(key,limit);passwordOperations++;
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
   if(path==='/vpn/api/telegram'&&req.method==='GET')return send(res,200,{available:botReady,...telegram.state(id,session.token_hash)});
   if(path==='/vpn/api/telegram'&&req.method==='DELETE'){telegram.disconnect(id);return send(res,200,{ok:true});}
   if(path==='/vpn/api/telegram/link'&&req.method==='POST'){
    if(!botReady)return send(res,503,{error:'Telegram-бот ещё подключается'});
    return send(res,200,{url:`https://t.me/${botUsername}?start=bind_${telegram.issue(id,session.token_hash)}`});
   }
   if(path==='/vpn/api/telegram/confirm'&&req.method==='POST'){if(!botReady)return send(res,503,{error:'Telegram-бот ещё подключается'});telegram.confirm(id,session.token_hash);return send(res,200,{ok:true});}
   if(path.startsWith('/vpn/api/admin/')){
    if(session.identity.role!=='admin')return send(res,403,{error:'Только для администратора'});
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
  }catch(e){send(res,400,{error:e.message==='Unlimited access is reserved for existing users'?'Новым пользователям нужна подписка с датой окончания':['Wrong current password','Choose a new password'].includes(e.message)?'Проверь текущий пароль и выбери новый':e.message.startsWith('Password must')?'Пароль должен содержать от12 до128 символов':'Запрос не выполнен. Проверь данные.'});}
 });server.headersTimeout=10000;server.requestTimeout=15000;
 return {server,users};
}
if(process.argv[1]?.endsWith('/server.mjs')){
 if(!process.env.VPN_DATABASE_PATH)throw new Error('Private database path required');
 const store=new VpnStore(process.env.VPN_DATABASE_PATH);
 const {server}=createApp({store,revision:process.env.VPN_REVISION||'unknown',botUsername:process.env.VPN_TELEGRAM_BOT_USERNAME||''});
 server.listen(Number(process.env.VPN_PORT)||8796,'127.0.0.1');
 process.on('SIGTERM',()=>server.close(()=>{store.close();process.exit(0);}));
}
