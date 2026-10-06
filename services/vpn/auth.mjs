import { randomBytes,createHash,scrypt as derive,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(derive), sha=x=>createHash('sha256').update(x).digest('hex');
export const temporaryPassword=()=>randomBytes(18).toString('base64url');
export async function passwordHash(password) {
 if(typeof password!=='string'||password.length<12||password.length>128) throw new Error('Password must contain12–128 characters');
 const salt=randomBytes(16).toString('hex');
 const key=await scrypt(password,salt,64,{N:65536,r:8,p:2,maxmem:128*1024*1024});
 return `${salt}:${key.toString('hex')}`;
}
export async function checkPassword(password,hash) {
 if(typeof password!=='string'||password.length>128) return false;
 const [salt,encoded]=hash.split(':');
 const key=await scrypt(password,salt,64,{N:65536,r:8,p:2,maxmem:128*1024*1024});
 return encoded?.length===128&&timingSafeEqual(key,Buffer.from(encoded,'hex'));
}
export class Accounts {
 constructor(store,{clock=Date.now}={}) {
  this.store=store;this.db=store.db;this.clock=clock;this.dummyHash=passwordHash(temporaryPassword());
  this.db.exec(`CREATE TABLE IF NOT EXISTS identities(account_id TEXT PRIMARY KEY REFERENCES accounts(id),
   login TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', must_change INTEGER NOT NULL DEFAULT 1, enabled INTEGER NOT NULL DEFAULT 1);
   CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES identities(account_id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS managed_subscriptions(account_id TEXT PRIMARY KEY REFERENCES accounts(id),
    panel_login TEXT UNIQUE, profile_url TEXT, expires_at INTEGER NOT NULL DEFAULT 0, unlimited INTEGER NOT NULL DEFAULT 0, devices INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, deleted INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0, sync_state TEXT NOT NULL DEFAULT 'synced');
   CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS admin_jobs(id INTEGER PRIMARY KEY,account_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',error TEXT,created_at INTEGER NOT NULL);`);
  if(!this.db.prepare('PRAGMA table_info(managed_subscriptions)').all().some(x=>x.name==='allow_unlimited'))this.store.transaction(()=>{
   this.db.exec('ALTER TABLE managed_subscriptions ADD COLUMN allow_unlimited INTEGER NOT NULL DEFAULT 0');
   // One-time preservation of existing imported unlimited subscriptions.
   this.db.exec("UPDATE managed_subscriptions SET allow_unlimited=1 WHERE unlimited=1 AND panel_login IS NOT NULL");
  });
  if(!this.db.prepare('PRAGMA table_info(managed_subscriptions)').all().some(x=>x.name==='entitlement_revision'))this.db.exec('ALTER TABLE managed_subscriptions ADD COLUMN entitlement_revision INTEGER NOT NULL DEFAULT -1');
  if(!this.db.prepare('PRAGMA table_info(identities)').all().some(x=>x.name==='password_set'))this.db.exec('ALTER TABLE identities ADD COLUMN password_set INTEGER NOT NULL DEFAULT 1');
  this.db.exec('CREATE TABLE IF NOT EXISTS session_auth(token_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,method TEXT NOT NULL,verified_at INTEGER NOT NULL)');
 }
 normalize(login){if(typeof login!=='string'||!login.trim()||login.length>80)throw new Error('Invalid login');return login.trim().toLowerCase();}
 async add({login,password=temporaryPassword(),role='user',panelLogin=null,profileUrl=null,expiresAt=0,unlimited=false,devices=0,enabled=true,actor=null,allowUnlimited=false}) {
  login=this.normalize(login);if(!['user','admin'].includes(role))throw new Error('Invalid role');
  if(unlimited&&!allowUnlimited)throw new Error('Unlimited access is reserved for existing users');
  if(this.db.prepare('SELECT 1 FROM identities WHERE login=?').get(login))return {created:false};
  const hash=await passwordHash(password);
  return this.store.transaction(()=>{
   const account=this.store.createAccount(`${randomBytes(16).toString('hex')}@accounts.invalid`);
   this.db.prepare('INSERT INTO identities(account_id,login,password_hash,role) VALUES(?,?,?,?)').run(account.id,login,hash,role);
   this.db.prepare('INSERT INTO managed_subscriptions(account_id,panel_login,profile_url,expires_at,unlimited,devices,enabled) VALUES(?,?,?,?,?,?,?)').run(account.id,panelLogin,profileUrl,expiresAt,Number(unlimited),devices,Number(enabled));
   this.db.prepare('UPDATE managed_subscriptions SET allow_unlimited=? WHERE account_id=?').run(Number(allowUnlimited),account.id);
   if(!allowUnlimited)this.db.prepare("UPDATE managed_subscriptions SET enabled=0,sync_state='awaiting_payment' WHERE account_id=?").run(account.id);
   if(actor)this.editInternal(actor,account.id,{expiresAt,unlimited,devices,enabled});
   return {created:true,accountId:account.id,login,password};
  });
 }
 async login(login,password) {
  const identity=this.db.prepare('SELECT * FROM identities WHERE login=?').get(this.normalize(login));
  const valid=await checkPassword(password,identity?.password_hash||await this.dummyHash);
  if(!identity?.enabled||!valid)return null;
  return this.newSession(identity.account_id);
 }
 newSession(accountId,{method='password'}={}){
  this.db.prepare('DELETE FROM sessions WHERE expires<=?').run(this.clock());
  const token=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url');
  this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(sha(token),accountId,csrf,this.clock()+12*3600_000);
  this.db.prepare('INSERT INTO session_auth VALUES(?,?,?)').run(sha(token),method,this.clock());
  return {token,csrf,identity:this.identity(accountId)};
 }
 identity(accountId){return this.db.prepare('SELECT account_id,login,role,must_change,enabled FROM identities WHERE account_id=?').get(accountId);}
 session(token){
  if(!token)return null;
  const session=this.db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires>?').get(sha(token),this.clock());
  if(!session)return null;const identity=this.identity(session.account_id);
  return identity?.enabled?{...session,identity}:null;
 }
 logout(token){this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(token));}
 async setPassword(accountId,sessionHash,next){const proof=this.db.prepare('SELECT * FROM session_auth WHERE token_hash=? AND verified_at>?').get(sessionHash,this.clock()-300000);if(!proof)throw new Error('Повтори вход перед установкой пароля');const hash=await passwordHash(next);this.store.transaction(()=>{this.db.prepare('UPDATE identities SET password_hash=?,password_set=1,must_change=0 WHERE account_id=?').run(hash,accountId);this.db.prepare('DELETE FROM sessions WHERE account_id=?').run(accountId);});return this.newSession(accountId);}
 async changePassword(accountId,current,next){
  const old=this.db.prepare('SELECT password_hash FROM identities WHERE account_id=?').get(accountId);
  if(!old||!await checkPassword(current,old.password_hash))throw new Error('Wrong current password');
  if(current===next)throw new Error('Choose a new password');
  const hash=await passwordHash(next);
  this.store.transaction(()=>{
   const changed=this.db.prepare('UPDATE identities SET password_hash=?,must_change=0 WHERE account_id=? AND password_hash=?').run(hash,accountId,old.password_hash);
   if(!changed.changes)throw new Error('Wrong current password');
   this.db.prepare('DELETE FROM sessions WHERE account_id=?').run(accountId);
  });return this.newSession(accountId);
 }
 list(){return this.db.prepare('SELECT identities.account_id,login,role,must_change,identities.enabled AS account_enabled,managed_subscriptions.* FROM identities JOIN managed_subscriptions USING(account_id) ORDER BY login').all().map(({profile_url,...x})=>x);}
 subscription(accountId){const s=this.db.prepare('SELECT * FROM managed_subscriptions WHERE account_id=?').get(accountId);if(!s)return {active:false};const paid=this.store.subscription(accountId),required=!s.allow_unlimited&&!paid.expiresAt&&this.identity(accountId)?.role==='user';return {...s,sync_state:!s.allow_unlimited&&paid.active&&s.sync_state==='awaiting_payment'?'pending':s.sync_state,profile_url:required?null:s.profile_url,payment_required:Boolean(required),payment_confirmed:paid.active,paid_expires_at:paid.expiresAt,active:Boolean(!s.deleted&&s.enabled&&(s.unlimited||s.expires_at>this.clock())&&(s.allow_unlimited||paid.active))};}
 edit(actor,id,patch){
  if(this.identity(actor)?.role!=='admin')throw new Error('Forbidden');
  return this.store.transaction(()=>this.editInternal(actor,id,patch));
 }
 editInternal(actor,id,patch){
   if(this.identity(actor)?.role!=='admin')throw new Error('Forbidden');
   const old=this.subscription(id);if(!old.account_id||this.identity(id)?.role==='admin')throw new Error('Subscription not found');
   let expires=patch.expiresAt??old.expires_at;const devices=patch.devices??old.devices;
   if(!Number.isSafeInteger(expires)||expires<0||!Number.isInteger(devices)||devices<0||devices>1000)throw new Error('Invalid limits');
   let enabled=patch.enabled??Boolean(old.enabled);const unlimited=patch.unlimited??Boolean(old.unlimited),deleted=patch.deleted??Boolean(old.deleted);
   if([enabled,unlimited,deleted].some(x=>typeof x!=='boolean'))throw new Error('Invalid status');
   if(unlimited&&!old.allow_unlimited)throw new Error('Unlimited access is reserved for existing users');
   if(enabled&&!deleted&&!unlimited&&!expires)throw new Error('Specify expiry or unlimited access');
   const paid=this.store.subscription(id);if(!old.allow_unlimited){enabled=enabled&&paid.active;if(paid.expiresAt)expires=Math.min(expires,paid.expiresAt);}
   const rev=old.revision+1;
   const needsPanel=Boolean(old.panel_login||enabled),sync=needsPanel?'pending':old.allow_unlimited||paid.expiresAt?'synced':'awaiting_payment';
   this.db.prepare('UPDATE managed_subscriptions SET expires_at=?,unlimited=?,devices=?,enabled=?,deleted=?,revision=?,sync_state=? WHERE account_id=?').run(expires,Number(unlimited),devices,Number(enabled),Number(deleted),rev,sync,id);
   if(needsPanel)this.db.prepare('INSERT INTO admin_jobs(account_id,revision,payload,created_at) VALUES(?,?,?,?)').run(id,rev,JSON.stringify({panelLogin:old.panel_login,expiresAt:expires,unlimited,devices,enabled:enabled&&!deleted}),this.clock());
   this.db.prepare('INSERT INTO audit(actor,action,target,at) VALUES(?,?,?,?)').run(actor,deleted?'subscription.delete':'subscription.update',id,this.clock());
   return this.subscription(id);
 }
}
