import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { chmodSync, openSync, closeSync, lstatSync } from 'node:fs';
const DAY = 86_400_000;
const positive = x => Number.isSafeInteger(x) && x > 0;
export class VpnStore {
  constructor(path, { plans = [], clock = Date.now } = {}) {
    this.clock = clock;
    this.plans = new Map(plans.map(p => {
      if (![30,90,180,365].includes(p.days) || !positive(p.priceMinor) || p.priceMinor > 1_000_000_000 || (!Number.isSafeInteger(p.devices) || p.devices < 0)) throw new Error('Invalid approved plan');
      return [String(p.days), Object.freeze({ ...p, devices:0 })];
    }));
    if (path !== ':memory:') {
      try { closeSync(openSync(path,'ax',0o600)); }
      catch (e) { if (e.code !== 'EEXIST') throw e; }
      if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) throw new Error('Private database must be a regular file');
      chmodSync(path,0o600);
    }
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
        profile_ref TEXT UNIQUE NOT NULL, revision INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
        request_key TEXT NOT NULL, days INTEGER NOT NULL, price_minor INTEGER NOT NULL,
        devices INTEGER NOT NULL, payment_id TEXT UNIQUE, state TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL, UNIQUE(account_id,request_key));
      CREATE TABLE IF NOT EXISTS grants(order_id TEXT PRIMARY KEY REFERENCES orders(id),
        account_id TEXT NOT NULL REFERENCES accounts(id), granted_at INTEGER NOT NULL, reversed INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS refunds(id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id));
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
        revision INTEGER NOT NULL, expires_at INTEGER NOT NULL, devices INTEGER NOT NULL,
        state TEXT NOT NULL DEFAULT 'pending', lease_until INTEGER NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0, UNIQUE(account_id,revision));
      CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
        message TEXT NOT NULL, created_at INTEGER NOT NULL);`);
  }
  close() { this.db.close(); }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  account(id) {
    const account = this.db.prepare('SELECT * FROM accounts WHERE id=?').get(id);
    if (!account) throw new Error('Account not found');
    return account;
  }
  createAccount(email) {
    email = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Invalid email');
    const id = randomUUID();
    this.db.prepare('INSERT OR IGNORE INTO accounts VALUES(?,?,?,0,?)').run(id,email,randomUUID(),this.clock());
    return this.db.prepare('SELECT * FROM accounts WHERE email=?').get(email);
  }
  createOrder(accountId, period, requestKey) {
    return this.transaction(() => this.createOrderInternal(accountId,period,requestKey));
  }
  createOrderInternal(accountId, period, requestKey) {
    this.account(accountId);
    if (typeof requestKey !== 'string' || requestKey.length < 8 || requestKey.length > 128) throw new Error('Invalid request key');
    const old = this.db.prepare('SELECT * FROM orders WHERE account_id=? AND request_key=?').get(accountId,requestKey);
    if (old) { if (String(old.days) !== String(period)) throw new Error('Request key already used'); return old; }
    const plan = this.plans.get(String(period));
    if (!plan) throw new Error('Plan unavailable');
    const id = randomUUID();
    this.db.prepare('INSERT INTO orders(id,account_id,request_key,days,price_minor,devices,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(id,accountId,requestKey,plan.days,plan.priceMinor,plan.devices,this.clock());
    return this.order(accountId,id);
  }
  order(accountId,id) {
    const order = this.db.prepare('SELECT * FROM orders WHERE id=? AND account_id=?').get(id,accountId);
    if (!order) throw new Error('Order not found');
    return order;
  }
  bindPayment(accountId,orderId,paymentId) {
    if (typeof paymentId !== 'string' || paymentId.length > 128 || !paymentId) throw new Error('Invalid payment ID');
    return this.transaction(() => {
      const order = this.order(accountId,orderId);
      if (order.payment_id && order.payment_id !== paymentId) throw new Error('Payment already bound');
      this.db.prepare('UPDATE orders SET payment_id=? WHERE id=?').run(paymentId,orderId);
      return this.order(accountId,orderId);
    });
  }
  subscription(accountId) {
    const account = this.account(accountId);
    const rows = this.db.prepare(`SELECT orders.days,orders.devices,grants.granted_at FROM grants
      JOIN orders ON orders.id=grants.order_id WHERE grants.account_id=? AND grants.reversed=0 AND orders.state='paid'
      ORDER BY grants.granted_at,orders.id`).all(accountId);
    let expiresAt = 0, devices = 0;
    for (const row of rows) {
      expiresAt = Math.max(expiresAt,row.granted_at) + row.days * DAY;
      devices = 0; // Device count is unrestricted, including historical paid orders.
    }
    return { accountId, profileRef:account.profile_ref, revision:account.revision, expiresAt,
      active:expiresAt > this.clock(), devices };
  }
  enqueue(accountId) {
    this.db.prepare('UPDATE accounts SET revision=revision+1 WHERE id=?').run(accountId);
    const s = this.subscription(accountId);
    this.db.prepare('INSERT INTO jobs(id,account_id,revision,expires_at,devices) VALUES(?,?,?,?,?)')
      .run(randomUUID(),accountId,s.revision,s.expiresAt,s.devices);
    return s;
  }
  // Internal only: payment must be fetched by an authenticated provider adapter.
  confirmPayment(payment, { testMode = true } = {}) {
    return this.transaction(() => {
      const order = this.db.prepare('SELECT * FROM orders WHERE payment_id=?').get(payment.id);
      if (!order) throw new Error('Unknown payment');
      if (payment.status !== 'succeeded' || payment.paid !== true || payment.test !== testMode ||
          payment.metadata?.order_id !== order.id || payment.amount?.currency !== 'RUB' ||
          payment.amount?.value !== (order.price_minor / 100).toFixed(2)) throw new Error('Payment verification failed');
      if (order.state === 'refunded') return this.subscription(order.account_id);
      if (order.state === 'paid') return this.subscription(order.account_id);
      this.db.prepare('INSERT INTO grants VALUES(?,?,?,0)').run(order.id,order.account_id,this.clock());
      this.db.prepare("UPDATE orders SET state='paid' WHERE id=?").run(order.id);
      return this.enqueue(order.account_id);
    });
  }
  confirmFullRefund(refund) {
    if (typeof refund.id !== 'string' || !refund.id || refund.id.length > 128) throw new Error('Invalid refund ID');
    return this.transaction(() => {
      const order = this.db.prepare('SELECT * FROM orders WHERE payment_id=?').get(refund.payment_id);
      if (!order || !['paid','refunded'].includes(order.state) || refund.status !== 'succeeded' ||
        refund.amount?.currency !== 'RUB' || refund.amount?.value !== (order.price_minor / 100).toFixed(2))
        throw new Error('Refund verification failed');
      const prior = this.db.prepare('SELECT * FROM refunds WHERE id=?').get(refund.id);
      if (prior && prior.order_id !== order.id) throw new Error('Refund already bound');
      if (prior || order.state === 'refunded') return this.subscription(order.account_id);
      this.db.prepare('INSERT INTO refunds VALUES(?,?)').run(refund.id,order.id);
      this.db.prepare('UPDATE grants SET reversed=1 WHERE order_id=?').run(order.id);
      this.db.prepare("UPDATE orders SET state='refunded' WHERE id=?").run(order.id);
      return this.enqueue(order.account_id);
    });
  }
  claimJob({ leaseMs = 60_000 } = {}) {
    if (!positive(leaseMs)) throw new Error('Invalid lease');
    return this.transaction(() => {
      const now = this.clock();
      const job = this.db.prepare("SELECT * FROM jobs WHERE state!='done' AND lease_until<=? ORDER BY rowid LIMIT 1").get(now);
      if (!job) return null;
      this.db.prepare("UPDATE jobs SET state='running',lease_until=?,attempts=attempts+1 WHERE id=?").run(now+leaseMs,job.id);
      const current = this.subscription(job.account_id);
      return { ...job, attempts:job.attempts+1, lease_until:now+leaseMs, current,
        superseded:job.revision !== current.revision };
    });
  }
  finishJob(id,attempt) {
    const changed = this.db.prepare("UPDATE jobs SET state='done',lease_until=0 WHERE id=? AND state='running' AND attempts=? AND lease_until>?")
      .run(id,attempt,this.clock());
    if (!changed.changes) throw new Error('Job lease lost');
  }
  createTicket(accountId,message) {
    this.account(accountId);
    if (typeof message !== 'string' || !message.trim() || message.length > 5000) throw new Error('Invalid message');
    const id = randomUUID();
    this.db.prepare('INSERT INTO tickets VALUES(?,?,?,?)').run(id,accountId,message.trim(),this.clock());
    return this.ticket(accountId,id);
  }
  ticket(accountId,id) {
    const ticket = this.db.prepare('SELECT * FROM tickets WHERE id=? AND account_id=?').get(id,accountId);
    if (!ticket) throw new Error('Ticket not found');
    return ticket;
  }
}
