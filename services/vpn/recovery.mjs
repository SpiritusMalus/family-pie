import {randomBytes,randomInt,createHash,timingSafeEqual} from 'node:crypto';
import {passwordHash} from './auth.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const invalid=()=>{const e=new Error('Код или ссылка не подходят либо истекли. Запроси восстановление ещё раз');e.code='INVALID_RECOVERY';throw e;};
const credential=identity=>hash(identity.password_hash+':'+identity.password_set);
const conflict=(expected,current)=>{if(current&&current!==expected){const e=new Error('Сейчас открыт другой аккаунт. Выйди из него перед восстановлением');e.code='LOGIN_ACCOUNT_CONFLICT';throw e;}};
const passwordPolicy=value=>{if(typeof value!=='string'||value.length<12||value.length>128)throw new Error('Password must contain12–128 characters');};

// A name, login, purchase receipt or unverified email is not recovery authority.
// Only an established verified email, confirmed Telegram binding, or a recent
// administrator's explicit known-channel ownership check can issue reset proof.
export class PasswordRecovery {
 constructor(store,users,{origin='https://family-spy.ru',send=null,clock=store.clock}={}){
  const url=new URL(origin);if(url.origin!==origin||url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('Invalid recovery origin');
  this.store=store;this.db=store.db;this.users=users;this.origin=origin;this.send=send;this.clock=clock;this.deliveries=new Set();this.stopping=false;
  this.db.exec(`CREATE TABLE IF NOT EXISTS recovery_challenges(id TEXT PRIMARY KEY,identifier_hash TEXT NOT NULL,account_id TEXT REFERENCES identities(account_id),code_hash TEXT NOT NULL,email_hash TEXT,credential_version TEXT,created_at INTEGER NOT NULL,expires INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,delivery TEXT NOT NULL DEFAULT 'none');
   CREATE TABLE IF NOT EXISTS recovery_rate(identifier_hash TEXT PRIMARY KEY,window_start INTEGER NOT NULL,last_issued INTEGER NOT NULL,count INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS recovery_tokens(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES identities(account_id),kind TEXT NOT NULL,credential_version TEXT NOT NULL,binding_chat TEXT,binding_generation TEXT,issued_by TEXT,request_key TEXT,created_at INTEGER NOT NULL,expires INTEGER NOT NULL,UNIQUE(issued_by,request_key));
   CREATE TABLE IF NOT EXISTS recovery_admin_requests(actor TEXT NOT NULL,request_key TEXT NOT NULL,account_id TEXT NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(actor,request_key));`);
 }
 identity(accountId){return this.db.prepare('SELECT * FROM identities WHERE account_id=?').get(accountId);}
 emailOwner(identifier){
  const login=this.db.prepare('SELECT i.*,v.email AS verified_email FROM identities i JOIN verified_emails v USING(account_id) WHERE i.enabled=1 AND i.login=?').get(identifier),email=this.db.prepare('SELECT i.*,v.email AS verified_email FROM identities i JOIN verified_emails v USING(account_id) WHERE i.enabled=1 AND v.email=?').get(identifier);
  if(login&&email&&login.account_id!==email.account_id)return null;
  return login||email||null;
 }
 request(identifier,{challengeId=null}={}){
  if(!this.send||this.stopping){const e=new Error('Письма для восстановления временно недоступны. Используй Telegram или поддержку');e.code='RECOVERY_UNAVAILABLE';throw e;}
  if(typeof identifier!=='string'||!identifier.trim()||identifier.length>254)throw new Error('Укажи логин или подтверждённый email');
  identifier=identifier.trim().toLowerCase();const key=hash(identifier),now=this.clock();
  const previous=typeof challengeId==='string'?this.db.prepare('SELECT * FROM recovery_challenges WHERE id=?').get(challengeId):null;
  if(previous&&previous.identifier_hash!==key)invalid();
  if(previous&&previous.created_at>now-60000&&previous.expires>now)return {accepted:true,challengeId:previous.id,expiresIn:Math.ceil((previous.expires-now)/1000),retryAfter:Math.max(1,Math.ceil((previous.created_at+60000-now)/1000))};
  const id=randomBytes(24).toString('base64url'),code=String(randomInt(0,100000000)).padStart(8,'0');
  let recipient=null;
  this.users.authMutation(()=>{
   this.db.prepare('DELETE FROM recovery_challenges WHERE created_at<?').run(now-3600000);this.db.prepare('DELETE FROM recovery_rate WHERE window_start<?').run(now-3600000);
   if(this.db.prepare('SELECT count(*) n FROM recovery_challenges').get().n>=1000){const e=new Error('Слишком много запросов. Повтори позже');e.code='RECOVERY_RATE_LIMIT';throw e;}
   const rate=this.db.prepare('SELECT * FROM recovery_rate WHERE identifier_hash=?').get(key),owner=this.emailOwner(identifier);
   const available=(!rate||rate.last_issued<=now-60000&&rate.count<5)&&(!owner||this.db.prepare('SELECT count(*) n FROM recovery_challenges WHERE account_id=? AND created_at>?').get(owner.account_id,now-3600000).n<5);
   if(available){
    this.db.prepare('INSERT INTO recovery_rate VALUES(?,?,?,1) ON CONFLICT(identifier_hash) DO UPDATE SET last_issued=excluded.last_issued,count=count+1').run(key,now,now);
    recipient=owner?.verified_email||null;
   }
   if(previous)this.db.prepare('DELETE FROM recovery_challenges WHERE id=? AND identifier_hash=?').run(previous.id,key);
   this.db.prepare('INSERT INTO recovery_challenges(id,identifier_hash,account_id,code_hash,email_hash,credential_version,created_at,expires,delivery) VALUES(?,?,?,?,?,?,?,?,?)').run(id,key,recipient?owner.account_id:null,hash(id+':'+code),recipient?hash(recipient):null,recipient?credential(owner):null,now,now+600000,recipient?'pending':'none');
  });
  if(recipient){
   // Network delivery never controls the public acknowledgement or reveals whether
   // the identifier exists. Raw codes live only in this short-lived send closure.
   const task=Promise.resolve().then(async()=>{
    if(!this.db.prepare('SELECT 1 FROM recovery_challenges WHERE id=? AND expires>?').get(id,this.clock()))return;
    try{await this.send(recipient,code,{purpose:'recovery'});this.db.prepare("UPDATE recovery_challenges SET delivery='sent' WHERE id=?").run(id);}
    catch{this.db.prepare("UPDATE recovery_challenges SET delivery='failed' WHERE id=?").run(id);}
   }).finally(()=>this.deliveries.delete(task));
   this.deliveries.add(task);
  }
  return {accepted:true,challengeId:id,expiresIn:600,retryAfter:60};
 }
 verifyEmail(id,code,currentAccountId){
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(id))invalid();
  const row=this.db.prepare('SELECT * FROM recovery_challenges WHERE id=? AND expires>? AND attempts<5').get(id,this.clock());
  if(!row)invalid();
  const valid=typeof code==='string'&&/^[0-9]{8}$/.test(code)&&timingSafeEqual(Buffer.from(hash(id+':'+code),'hex'),Buffer.from(row.code_hash,'hex'));
  if(!valid){this.db.prepare('UPDATE recovery_challenges SET attempts=attempts+1 WHERE id=?').run(id);invalid();}
  const identity=row.account_id&&this.identity(row.account_id),email=row.account_id&&this.db.prepare('SELECT email FROM verified_emails WHERE account_id=?').get(row.account_id);
  if(!identity?.enabled||credential(identity)!==row.credential_version||!email||hash(email.email)!==row.email_hash)invalid();
  conflict(row.account_id,currentAccountId);return row;
 }
 async confirm(challengeId,code,password,{accountId=null}={}){
  passwordPolicy(password);const proof=this.verifyEmail(challengeId,code,accountId),next=await passwordHash(password);
  return this.users.authMutation(()=>{const current=this.verifyEmail(challengeId,code,accountId);if(current.credential_version!==proof.credential_version)invalid();return this.finish(current.account_id,next);});
 }
 createToken(accountId,kind,{expiresIn=900,chatId=null,generation=null,issuedBy=null,requestKey=null}={}){
  const identity=this.identity(accountId);if(!identity?.enabled)invalid();
  const token=randomBytes(32).toString('base64url'),now=this.clock(),expiresAt=now+expiresIn*1000;
  this.db.prepare('DELETE FROM recovery_tokens WHERE expires<=? OR (account_id=? AND kind=?)').run(now,accountId,kind);
  this.db.prepare('INSERT INTO recovery_tokens VALUES(?,?,?,?,?,?,?,?,?,?)').run(hash(token),accountId,kind,credential(identity),chatId,generation,issuedBy,requestKey,now,expiresAt);
  return {url:this.origin+'/vpn/cabinet/auth/#recovery='+token,login:identity.login,expiresAt,expiresIn};
 }
 issueAdmin(session,accountId,{ownershipVerified=false,requestKey}={}){
  return this.users.authMutation(()=>{
   const actor=session&&this.db.prepare('SELECT i.account_id,i.enabled,i.must_change,i.role,s.expires,a.verified_at FROM sessions s JOIN identities i USING(account_id) JOIN session_auth a USING(token_hash) WHERE s.token_hash=?').get(session.token_hash);
   if(!actor?.enabled||actor.must_change||actor.role!=='admin'||actor.expires<=this.clock()||actor.verified_at<=this.clock()-300000)throw new Error('Подтверди вход администратора перед восстановлением');
   if(ownershipVerified!==true)throw new Error('Сначала проверь личность владельца через известный канал связи');
   if(typeof requestKey!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(requestKey))throw new Error('Некорректный запрос восстановления');
   const target=this.identity(accountId);if(!target?.enabled||target.role!=='user')throw new Error('Пользовательский аккаунт не найден');
   const prior=this.db.prepare('SELECT * FROM recovery_admin_requests WHERE actor=? AND request_key=?').get(actor.account_id,requestKey);
   if(prior){if(prior.account_id!==accountId)throw new Error('Запрос уже использован для другого аккаунта');return {alreadyIssued:true,login:target.login,expiresAt:prior.expires_at,expiresIn:Math.max(0,Math.ceil((prior.expires_at-this.clock())/1000))};}
   if(this.db.prepare("SELECT count(*) n FROM audit WHERE actor=? AND action='account.recovery.issue' AND at>?").get(actor.account_id,this.clock()-60000).n>=5){const e=new Error('Слишком много запросов. Повтори через минуту');e.code='RECOVERY_RATE_LIMIT';throw e;}
   const result=this.createToken(accountId,'admin',{issuedBy:actor.account_id,requestKey});
   this.db.prepare('INSERT INTO recovery_admin_requests VALUES(?,?,?,?)').run(actor.account_id,requestKey,accountId,result.expiresAt);
   this.db.prepare("INSERT INTO audit(actor,action,target,at) VALUES(?,'account.recovery.issue',?,?)").run(actor.account_id,accountId,this.clock());return result;
  });
 }
 issueTelegram(chatId){
  const id=String(chatId);if(!/^[1-9][0-9]{0,15}$/.test(id)||!Number.isSafeInteger(Number(id)))invalid();
  return this.users.authMutation(()=>{
   const row=this.db.prepare('SELECT l.*,i.enabled AS identity_enabled FROM telegram_links l JOIN identities i USING(account_id) WHERE l.chat_id=?').get(id);
   if(!row?.identity_enabled)invalid();
   // must_change is intentionally allowed only for a reset-only proof. No login
   // session or personal subscription is disclosed by this method.
   return this.createToken(row.account_id,'telegram',{expiresIn:300,chatId:id,generation:row.generation});
  });
 }
 token(token,currentAccountId){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))invalid();
  const row=this.db.prepare('SELECT * FROM recovery_tokens WHERE token_hash=? AND expires>?').get(hash(token),this.clock()),identity=row&&this.identity(row.account_id);
  if(!row||!['admin','telegram'].includes(row.kind)||!identity?.enabled||credential(identity)!==row.credential_version)invalid();
  if(row.kind==='admin'){const issuer=this.identity(row.issued_by);if(!issuer?.enabled||issuer.must_change||issuer.role!=='admin')invalid();}
  if(row.kind==='telegram'&&!this.db.prepare('SELECT 1 FROM telegram_links WHERE account_id=? AND chat_id=? AND generation=?').get(row.account_id,row.binding_chat,row.binding_generation))invalid();
  conflict(row.account_id,currentAccountId);return {...row,login:identity.login};
 }
 preview(token,{accountId=null}={}){const row=this.token(token,accountId);return {login:row.login,expiresAt:row.expires,expiresIn:Math.max(0,Math.ceil((row.expires-this.clock())/1000))};}
 async reset(token,password,{accountId=null}={}){
  passwordPolicy(password);const proof=this.token(token,accountId),next=await passwordHash(password);
  return this.users.authMutation(()=>{const row=this.token(token,accountId);if(row.credential_version!==proof.credential_version)invalid();return this.finish(row.account_id,next);});
 }
 finish(accountId,next){
  this.db.prepare('UPDATE identities SET password_hash=?,password_set=1,must_change=0 WHERE account_id=? AND enabled=1').run(next,accountId);
  this.db.prepare('DELETE FROM sessions WHERE account_id=?').run(accountId);
  this.db.prepare('DELETE FROM recovery_challenges WHERE account_id=?').run(accountId);this.db.prepare('DELETE FROM recovery_tokens WHERE account_id=?').run(accountId);
  for(const table of ['email_challenges','telegram_handoffs'])if(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))this.db.prepare(`DELETE FROM ${table} WHERE account_id=?`).run(accountId);
  this.db.prepare("INSERT INTO audit(actor,action,target,at) VALUES(?,'account.recovery.complete',?,?)").run(accountId,accountId,this.clock());
  return {ok:true,login:this.users.identity(accountId).login};
 }
 async shutdown(){this.stopping=true;await Promise.allSettled([...this.deliveries]);}
}
