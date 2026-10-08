import {randomUUID} from 'node:crypto';
const address=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export class PurchaseMail {
 constructor(store,{send=null,clock=store.clock}={}){
  this.store=store;this.db=store.db;this.send=send;this.clock=clock;this.running=null;this.stopping=false;
  this.db.exec(`CREATE TABLE IF NOT EXISTS purchase_mail_config(id INTEGER PRIMARY KEY CHECK(id=1),start_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS purchase_mail(order_id TEXT PRIMARY KEY REFERENCES orders(id),message_id TEXT UNIQUE NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL,created_at INTEGER NOT NULL,sent_at INTEGER);
   CREATE INDEX IF NOT EXISTS purchase_mail_pending ON purchase_mail(state,next_at);`);
  this.db.prepare('INSERT OR IGNORE INTO purchase_mail_config VALUES(1,?)').run(this.clock());
 }
 recover(){this.db.prepare("UPDATE purchase_mail SET state='uncertain' WHERE state='sending'").run();}
 order(id){return this.db.prepare(`SELECT o.id,o.account_id,o.days,o.receipt_email,g.reversed,o.state,i.enabled identity_enabled,s.deleted,s.enabled,s.sync_state,s.expires_at,s.allow_unlimited,s.entitlement_revision,a.revision
  FROM orders o JOIN grants g ON g.order_id=o.id AND g.account_id=o.account_id JOIN identities i ON i.account_id=o.account_id JOIN managed_subscriptions s ON s.account_id=o.account_id JOIN accounts a ON a.id=o.account_id WHERE o.id=?`).get(id);}
 enqueue(id){const o=this.order(id);if(!o||o.state!=='paid'||o.reversed||o.allow_unlimited||!address(o.receipt_email))return false;
  return Boolean(this.db.prepare('INSERT OR IGNORE INTO purchase_mail(order_id,message_id,next_at,created_at) VALUES(?,?,?,?)').run(id,'<'+randomUUID()+'@family-pie.ru>',this.clock(),this.clock()).changes);
 }
 plan(){const cutoff=this.db.prepare('SELECT start_at FROM purchase_mail_config WHERE id=1').get().start_at;
  for(const o of this.db.prepare("SELECT o.id FROM orders o JOIN grants g ON g.order_id=o.id WHERE o.state='paid' AND g.reversed=0 AND g.granted_at>=? AND NOT EXISTS(SELECT 1 FROM purchase_mail m WHERE m.order_id=o.id) ORDER BY g.granted_at LIMIT 100").all(cutoff))this.enqueue(o.id);
 }
 tick(){if(!this.send||this.stopping)return Promise.resolve(false);if(this.running)return this.running;
  this.running=this.deliver().finally(()=>{this.running=null;});return this.running;
 }
 async shutdown(){this.stopping=true;if(this.running)await this.running;}
 async deliver(){this.plan();for(const job of this.db.prepare("SELECT * FROM purchase_mail WHERE state='pending' AND next_at<=? ORDER BY created_at,rowid LIMIT 20").all(this.clock())){
   const o=this.order(job.order_id);
   if(!o||o.state!=='paid'||o.reversed||!o.identity_enabled||o.deleted||!address(o.receipt_email)||!this.store.subscription(o.account_id).active){this.db.prepare("UPDATE purchase_mail SET state='canceled' WHERE order_id=? AND state='pending'").run(job.order_id);continue;}
   if(!o.enabled||o.sync_state!=='synced'||o.entitlement_revision!==o.revision||o.expires_at<=this.clock())continue;
   if(!this.db.prepare("UPDATE purchase_mail SET state='sending',attempts=attempts+1 WHERE order_id=? AND state='pending'").run(job.order_id).changes)continue;
   try{
    const result=await this.send({to:o.receipt_email,days:o.days,expiresAt:o.expires_at,messageId:job.message_id});
    if(!result?.accepted?.some(x=>typeof x==='string'&&x.toLowerCase()===o.receipt_email.toLowerCase())){this.db.prepare("UPDATE purchase_mail SET state='failed' WHERE order_id=?").run(job.order_id);return true;}
    this.db.prepare("UPDATE purchase_mail SET state='sent',sent_at=? WHERE order_id=?").run(this.clock(),job.order_id);
   }catch(e){
    // An explicit SMTP rejection or connection failure before DATA is safe to retry.
    // A lost response during/after DATA is held: SMTP has no guaranteed idempotence.
    const temporary=Number.isInteger(e.responseCode)&&e.responseCode>=400&&e.responseCode<500;
    const beforeData=['CONN','EHLO','HELO','STARTTLS'].includes(e.command)&&['EDNS','ECONNECTION','ESOCKET','ETIMEDOUT'].includes(e.code);
    const retry=(temporary||beforeData)&&job.attempts<4;
    const permanent=Number.isInteger(e.responseCode)&&e.responseCode>=500||e.code==='EAUTH'||(temporary||beforeData)&&!retry;
    this.db.prepare('UPDATE purchase_mail SET state=?,next_at=? WHERE order_id=?').run(retry?'pending':permanent?'failed':'uncertain',this.clock()+Math.min(3600000,60000*2**job.attempts),job.order_id);
   }
   return true;
  }return false;
 }
}
