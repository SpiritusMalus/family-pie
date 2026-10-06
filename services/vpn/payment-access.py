"""Paid entitlement is the only non-legacy provisioning authority; no provider payloads."""
import json
DAY=86400000

def entitlement(app,account_id):
 account=app.execute('SELECT revision FROM accounts WHERE id=?',(account_id,)).fetchone()
 expires=0;devices=0
 for days,limit,granted in app.execute("SELECT o.days,o.devices,g.granted_at FROM grants g JOIN orders o ON o.id=g.order_id WHERE g.account_id=? AND g.reversed=0 AND o.state='paid' ORDER BY g.granted_at,o.id",(account_id,)):
  if days not in (30,90,180,365) or limit<=0 or granted<0:raise ValueError('Invalid approved entitlement')
  expires=max(expires,granted)+days*DAY;devices=limit
 return {'revision':account[0],'expires':expires,'devices':devices}

def reconcile(app,now):
 with app:
  rows=app.execute("SELECT s.* FROM managed_subscriptions s JOIN identities i USING(account_id) WHERE s.allow_unlimited=0 AND i.role='user'").fetchall()
  for row in rows:
   paid=entitlement(app,row['account_id']);active=paid['expires']>now
   changed=row['entitlement_revision']!=paid['revision']
   unsafe=row['enabled'] and not active
   if changed or unsafe:
    enabled=active and not row['deleted'];expires=paid['expires'] or row['expires_at'];devices=paid['devices'] or row['devices'];rev=row['revision']+1
    needs_panel=bool(row['panel_login'] or enabled)
    state='pending' if needs_panel else 'synced' if paid['expires'] else 'awaiting_payment'
    app.execute('UPDATE managed_subscriptions SET enabled=?,expires_at=?,devices=?,revision=?,entitlement_revision=?,sync_state=? WHERE account_id=?',(int(enabled),expires,devices,rev,paid['revision'],state,row['account_id']))
    if needs_panel:
     payload={'panelLogin':row['panel_login'],'expiresAt':expires,'unlimited':False,'devices':devices,'enabled':bool(enabled)}
     app.execute('INSERT INTO admin_jobs(account_id,revision,payload,created_at) VALUES(?,?,?,?)',(row['account_id'],rev,json.dumps(payload),now))
   current=app.execute('SELECT * FROM managed_subscriptions WHERE account_id=?',(row['account_id'],)).fetchone()
   if current['sync_state'] in ('synced','awaiting_payment') and current['entitlement_revision']==paid['revision']:
    app.execute("UPDATE jobs SET state='done',lease_until=0 WHERE account_id=? AND revision<=?",(row['account_id'],paid['revision']))
