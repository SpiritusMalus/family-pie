#!/usr/bin/env python3
"""Narrow root bridge: client operations only, private backups, no token logging."""
import sqlite3,json,time,os,re,subprocess,urllib.request,urllib.parse,shutil,fcntl,socket,secrets
from pathlib import Path
import importlib.util
_spec=importlib.util.spec_from_file_location('payment_access',Path(__file__).with_name('payment-access.py'))
_payments=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_payments)
DB=Path('/var/lib/family-vpn/cabinet.sqlite')
XRAY='/usr/local/x-ui/bin/xray-linux-amd64'
PANEL=Path('/etc/x-ui/x-ui.db');CFG=Path('/opt/submerge/config.json');NODES=Path('/opt/submerge/nodes.json');HY=Path('/etc/xray-hy2/config.json')
def run(args,timeout=30):
 r=subprocess.run(args,capture_output=True,timeout=timeout)
 if r.returncode:raise RuntimeError('Command validation failed')
 return r.stdout.decode(errors='replace')
def dump(path,value):
 tmp=path.with_suffix(path.suffix+'.cabinet.pending');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');os.chmod(tmp,0o600);os.replace(tmp,path)
def synchronize(app,created=False):
 panel=sqlite3.connect('file:'+str(PANEL)+'?mode=ro',uri=True)
 if created:
  count=panel.execute("SELECT count(*) FROM clients WHERE email NOT LIKE 'root-lab-%'").fetchone()[0]
  nodes=json.loads(NODES.read_text());nodes['expect_clients']=count;dump(NODES,nodes)
 hy=json.loads(HY.read_text()); inbound=next(i for i in hy['inbounds'] if i['protocol']=='hysteria')
 managed={r[0] for r in app.execute('SELECT panel_login FROM managed_subscriptions WHERE panel_login IS NOT NULL')}
 wanted={r[0]:r[1] for r in panel.execute('SELECT email,uuid,enable,expiry_time FROM clients') if r[0] in managed and r[2] and (r[3]<=0 or r[3]>int(time.time()*1000))}
 users=[u for u in inbound['settings']['users'] if u.get('email') not in managed]
 users += [{'email':email,'auth':uuid} for email,uuid in sorted(wanted.items())]
 if sorted(users,key=lambda u:u.get('email',''))!=sorted(inbound['settings']['users'],key=lambda u:u.get('email','')):
  inbound['settings']['users']=users
  old=HY.read_bytes();dump(HY,hy)
  try:run([XRAY,'-test','-config',str(HY)]);run(['systemctl','restart','xray-hy2'])
  except Exception:HY.write_bytes(old);run(['systemctl','restart','xray-hy2']);raise
 panel.close()
 old_cfg=CFG.read_bytes();run(['python3','/opt/submerge/gen_config.py'])
 if CFG.read_bytes()!=old_cfg:run(['systemctl','restart','submerge'])
 for unit in ['x-ui','xray-hy2','submerge','nginx']:
  run(['systemctl','is-active','--quiet',unit])
 run([XRAY,'-test','-config','/usr/local/x-ui/bin/config.json'])
 with socket.create_connection(('127.0.0.1',8443),timeout=3):pass

def main():
 lock=open('/run/family-vpn-panel.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 app=sqlite3.connect(DB,timeout=5);app.row_factory=sqlite3.Row;app.execute('PRAGMA foreign_keys=ON')
 now=int(time.time()*1000)
 _payments.reconcile(app,now)
 # Expiry is applied to both transports, not merely hidden in the website.
 for row in app.execute('SELECT * FROM managed_subscriptions WHERE enabled=1 AND unlimited=0 AND expires_at>0 AND expires_at<=? AND sync_state="synced"',(now,)).fetchall():
  rev=row['revision']+1;payload={'panelLogin':row['panel_login'],'expiresAt':row['expires_at'],'unlimited':False,'devices':row['devices'],'enabled':False}
  app.execute("UPDATE managed_subscriptions SET enabled=0,revision=?,sync_state='pending' WHERE account_id=?",(rev,row['account_id']))
  app.execute('INSERT INTO admin_jobs(account_id,revision,payload,created_at) VALUES(?,?,?,?)',(row['account_id'],rev,json.dumps(payload),now))
 app.commit()
 job=app.execute("SELECT * FROM admin_jobs WHERE state='pending' ORDER BY id LIMIT 1").fetchone()
 if not job:return
 managed=app.execute('SELECT * FROM managed_subscriptions WHERE account_id=?',(job['account_id'],)).fetchone()
 if not managed or managed['revision']!=job['revision']:
  app.execute("UPDATE admin_jobs SET state='superseded' WHERE id=?",(job['id'],));app.commit();return
 payload=json.loads(job['payload']);expires=payload['expiresAt'];devices=payload['devices'];enabled=payload['enabled'];unlimited=payload['unlimited']
 if type(expires)!=int or expires<0 or type(devices)!=int or not 0<=devices<=1000 or type(enabled)!=bool or type(unlimited)!=bool:raise RuntimeError('Invalid job payload')
 if not managed['allow_unlimited']:
  paid=_payments.entitlement(app,job['account_id'])
  enabled=enabled and paid['expires']>now
  unlimited=False
  if paid['expires']:expires=min(expires,paid['expires'])
  if not enabled and not managed['panel_login']:
   app.execute("UPDATE managed_subscriptions SET enabled=0,sync_state=? WHERE account_id=?",('synced' if paid['expires'] else 'awaiting_payment',job['account_id']))
   app.execute("UPDATE admin_jobs SET state='blocked_payment' WHERE id=?",(job['id'],));app.commit();return
 account=app.execute('SELECT profile_ref FROM accounts WHERE id=?',(job['account_id'],)).fetchone()
 name=managed['panel_login'] or 'web_'+job['account_id'].replace('-','')[:24]
 if name.startswith('root-lab-') or len(name)>100:raise RuntimeError('Unsupported client scope')
 backup=Path('/root/family-vpn-backups')/str(time.time_ns());backup.mkdir(parents=True,mode=0o700);os.chmod(backup.parent,0o700)
 panel=sqlite3.connect(PANEL,timeout=10);copy=sqlite3.connect(backup/'panel.sqlite');panel.backup(copy);copy.close();os.chmod(backup/'panel.sqlite',0o600)
 app_copy=sqlite3.connect(backup/'cabinet.sqlite');app.backup(app_copy);app_copy.close();os.chmod(backup/'cabinet.sqlite',0o600)
 for path,label in [(CFG,'submerge.config.json'),(NODES,'nodes.json'),(HY,'hy2.config.json')]:
  shutil.copy2(path,backup/label);os.chmod(backup/label,0o600)
 before={r[0] for r in panel.execute('SELECT id FROM api_tokens')};original=None;created=False;token=None
 try:
  text=re.sub(r'\x1b\[[0-9;]*m','',run(['/usr/local/x-ui/x-ui','setting','-getApiToken']))
  match=re.search(r'(?:[Tt]oken)\s*[:=]\s*([A-Za-z0-9_.-]{20,})',text)
  if not match:raise RuntimeError('API credential format unavailable')
  token=match.group(1);settings=dict(panel.execute('SELECT key,value FROM settings'))
  base='http://127.0.0.1:'+str(settings.get('webPort','31123'))+'/'+settings.get('webBasePath','/').strip('/')+'/panel/api/clients/'
  def api(route,data=None):
   # GET uses database row id/uuid; mutation DTO calls the VPN UUID "id".
   if route.startswith('update/') and isinstance(data,dict) and 'id' in data:
    data=dict(data);data['id']=data['uuid']
    if isinstance(data.get('allowedIPs'),str):data['allowedIPs']=[x for x in re.split(r'[\s,]+',data['allowedIPs']) if x]
    for source,target in [('createdAt','created_at'),('updatedAt','updated_at')]:
     if source in data:data[target]=data[source]
   req=urllib.request.Request(base+route,data=json.dumps(data).encode() if data is not None else None,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},method='POST' if data is not None else 'GET')
   result=json.load(urllib.request.urlopen(req,timeout=15))
   if not result.get('success'):raise RuntimeError('Panel rejected operation')
   return result.get('obj')
  encoded=urllib.parse.quote(name,safe='')
  exists=panel.execute('SELECT 1 FROM clients WHERE email=?',(name,)).fetchone()
  if exists:original=api('get/'+encoded)['client'];client=dict(original)
  else:
   template_name=panel.execute("SELECT email FROM clients WHERE email NOT LIKE 'root-lab-%' AND email NOT LIKE 'web_%' ORDER BY email LIMIT 1").fetchone()[0]
   inbound_ids=api('get/'+urllib.parse.quote(template_name,safe=''))['inboundIds']
   sub_id=secrets.token_urlsafe(12)
   client={'email':name,'id':account['profile_ref'],'uuid':account['profile_ref'],'subId':sub_id,'flow':'xtls-rprx-vision','limitIp':devices,'totalGB':0,'expiryTime':0 if unlimited else expires,'enable':enabled}
   api('add',{'client':client,'inboundIds':inbound_ids});created=True
   loaded=api('get/'+encoded)['client'];loaded.update(client);client=loaded
  client.update({'expiryTime':0 if unlimited else expires,'limitIp':devices,'enable':enabled})
  api('update/'+encoded,client)
  readback=api('get/'+encoded)['client']
  for key in ['uuid','subId','flow','expiryTime','enable','limitIp']:
   if readback[key]!=client[key]:raise RuntimeError('Panel read-back mismatch')
  if created:
   app.execute('UPDATE managed_subscriptions SET panel_login=?,profile_url=? WHERE account_id=?',(name,'https://sub.family-pie.ru/sub/'+readback['subId'],job['account_id']));app.commit()
  synchronize(app,created)
  # Guard the current website revision: newer edits retain pending state.
  state='synced' if managed['allow_unlimited'] or _payments.entitlement(app,job['account_id'])['expires'] else 'awaiting_payment'
  app.execute("UPDATE managed_subscriptions SET sync_state=?,enabled=? WHERE account_id=? AND revision=?",(state,int(enabled),job['account_id'],job['revision']))
  app.execute("UPDATE admin_jobs SET state='done',error=NULL WHERE id=?",(job['id'],));app.commit()
  print(json.dumps({'job':job['id'],'state':'synced'}))
 except Exception:
  rollback=True
  try:
   if token:
    if original:api('update/'+encoded,original)
    elif created:api('del/'+encoded+'?keepTraffic=1',{})
    synchronize(app,created)
  except Exception:rollback=False
  app.execute("UPDATE managed_subscriptions SET sync_state='error' WHERE account_id=? AND revision=?",(job['account_id'],job['revision']))
  app.execute("UPDATE admin_jobs SET state='error',error=? WHERE id=?",('Operation failed; rollback '+('verified' if rollback else 'requires operator'),job['id']));app.commit()
  print(json.dumps({'job':job['id'],'state':'error','rollback':rollback}))
 finally:
  minted=[r[0] for r in panel.execute("SELECT id FROM api_tokens WHERE name LIKE 'cli-fallback-%'") if r[0] not in before]
  if len(minted)==1:panel.execute('DELETE FROM api_tokens WHERE id=?',(minted[0],));panel.commit()
  panel.close();app.close()
if __name__=='__main__':main()
