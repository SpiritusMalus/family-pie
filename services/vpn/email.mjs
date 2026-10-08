import {randomBytes,randomInt,createHash} from 'node:crypto';
import nodemailer from 'nodemailer';
import {readFileSync} from 'node:fs';
const hash=x=>createHash('sha256').update(x).digest('hex');
export class EmailLogin{
 constructor(store,users,{send=null,clock=store.clock}={}){this.store=store;this.users=users;this.db=store.db;this.clock=clock;this.send=send;this.db.exec(`CREATE TABLE IF NOT EXISTS verified_emails(account_id TEXT UNIQUE NOT NULL REFERENCES identities(account_id),email TEXT PRIMARY KEY);CREATE TABLE IF NOT EXISTS email_challenges(id TEXT PRIMARY KEY,email TEXT NOT NULL,account_id TEXT,session_hash TEXT REFERENCES sessions(token_hash) ON DELETE CASCADE,code_hash TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,expires INTEGER NOT NULL);`);}
 state(id){return {available:Boolean(this.send),email:this.db.prepare('SELECT email FROM verified_emails WHERE account_id=?').get(id)?.email||null};}
 async issue(email,session){if(!this.send)throw new Error('Вход по email ещё не подключён');if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Проверь email');email=email.trim().toLowerCase();this.db.prepare('DELETE FROM email_challenges WHERE expires<=?').run(this.clock());if(this.db.prepare('SELECT 1 FROM email_challenges WHERE email=? AND created_at>?').get(email,this.clock()-60000)||this.db.prepare('SELECT count(*) n FROM email_challenges').get().n>1000)throw new Error('Повтори через минуту');const owner=this.db.prepare('SELECT account_id FROM verified_emails WHERE email=?').get(email),id=randomBytes(24).toString('base64url');
  // Unknown addresses get the same acknowledgement, with no enumeration and no unsolicited message.
  if(!session&&!owner)return {challengeId:id};
  if(session&&owner&&owner.account_id!==session.account_id)throw new Error('Email привязан к другому аккаунту');
  const code=String(randomInt(0,100000000)).padStart(8,'0');this.db.prepare('INSERT INTO email_challenges(id,email,account_id,session_hash,code_hash,created_at,expires) VALUES(?,?,?,?,?,?,?)').run(id,email,session?.account_id||owner.account_id,session?.token_hash||null,hash(id+':'+code),this.clock(),this.clock()+300000);
  try{await this.send(email,code);}catch{this.db.prepare('DELETE FROM email_challenges WHERE id=?').run(id);throw new Error('Не удалось отправить письмо. Повтори позже');}return {challengeId:id};
 }
 confirm(id,code,session){const row=this.db.prepare('SELECT * FROM email_challenges WHERE id=? AND expires>? AND attempts<5').get(id,this.clock());if(!row||row.session_hash&&row.session_hash!==session?.token_hash)throw new Error('Код не подходит или устарел');this.db.prepare('UPDATE email_challenges SET attempts=attempts+1 WHERE id=?').run(id);if(typeof code!=='string'||!/^[0-9]{8}$/.test(code)||hash(id+':'+code)!==row.code_hash)throw new Error('Код не подходит или устарел');return this.store.transaction(()=>{this.db.prepare('DELETE FROM email_challenges WHERE id=?').run(id);if(row.session_hash){this.db.prepare('DELETE FROM verified_emails WHERE account_id=?').run(row.account_id);this.db.prepare('INSERT INTO verified_emails VALUES(?,?)').run(row.account_id,row.email);return {linked:true};}if(!this.users.identity(row.account_id)?.enabled)throw new Error('Аккаунт отключён');return this.users.newSession(row.account_id,{method:'email'});});}
 disconnect(id){if(!this.db.prepare('SELECT password_set FROM identities WHERE account_id=?').get(id)?.password_set&&!this.db.prepare('SELECT 1 FROM passkeys WHERE account_id=?').get(id)&&!this.db.prepare('SELECT 1 FROM google_identities WHERE account_id=?').get(id))throw new Error('Сначала добавь другой способ входа');this.db.prepare('DELETE FROM verified_emails WHERE account_id=?').run(id);}
}
export function smtpTransport(env=process.env,createTransport=options=>nodemailer.createTransport(options)){
 if(!env.VPN_SMTP_HOST||!env.VPN_SMTP_FROM)return null;
 const port=Number(env.VPN_SMTP_PORT||465);
 if(![465,587].includes(port))throw new Error('SMTP requires TLS on port465 or587');
 const password=env.VPN_SMTP_PASSWORD_FILE?readFileSync(env.VPN_SMTP_PASSWORD_FILE,'utf8').replace(/[\r\n]+$/,''):env.VPN_SMTP_PASSWORD;
 if(env.VPN_SMTP_USER&&(!password||/[\r\n]/.test(password)))throw new Error('Private SMTP password missing or invalid');
 return createTransport({host:env.VPN_SMTP_HOST,port,secure:port===465,requireTLS:true,
  auth:env.VPN_SMTP_USER?{user:env.VPN_SMTP_USER,pass:password}:undefined,
  tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},disableFileAccess:true,disableUrlAccess:true,
  connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000});
}
export function smtpSender(env=process.env,createTransport){const transport=smtpTransport(env,createTransport);if(!transport)return null;return (email,code)=>transport.sendMail({from:env.VPN_SMTP_FROM,to:email,subject:'Код входа в Family VPN',text:`Код Family VPN: ${code}\nДействует5 минут. Не передавай его другим. Если ты не запрашивал код, просто проигнорируй письмо.`});}

export function smtpPurchaseSender(env=process.env,createTransport){
 const transport=smtpTransport(env,createTransport);if(!transport)return null;
 return ({to,days,expiresAt,messageId})=>{
  const date=new Intl.DateTimeFormat('ru-RU',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Moscow'}).format(expiresAt);
  return transport.sendMail({from:{name:'Family VPN',address:env.VPN_SMTP_FROM},to:{address:to},messageId,subject:'Family VPN — подписка готова',text:`Оплата подтверждена. Подписка Family VPN на ${days} дней готова.
Текущий срок доступа: до ${date} (московское время).
Количество устройств не ограничено.

Открой кабинет, чтобы добавить подключение в Happ или получить ссылку и QR-код:
https://family-pie.ru/vpn/cabinet/#home

Актуальный статус подписки всегда доступен в кабинете. Повторно платить не нужно.
Кассовый чек — отдельный документ от платёжного сервиса.
Если нужна помощь, ответь на это письмо или открой поддержку в кабинете.`});
 };
}
