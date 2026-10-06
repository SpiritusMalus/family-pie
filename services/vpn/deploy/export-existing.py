#!/usr/bin/env python3
"""Read-only panel/profile preflight; write private importer input exclusively."""
import json,os,re,sqlite3,sys
from pathlib import Path

def export(panel_path,config_path,output_path):
 con=sqlite3.connect('file:'+str(panel_path)+'?mode=ro',uri=True);con.row_factory=sqlite3.Row
 try:
  rows=con.execute("SELECT email,sub_id,uuid,enable,expiry_time,limit_ip FROM clients WHERE email NOT LIKE 'root-lab-%' ORDER BY email").fetchall()
 finally:con.close()
 profiles=json.loads(Path(config_path).read_text())['clients']
 by_name={x['name']:x for x in profiles}
 if len(by_name)!=len(profiles) or not rows:raise ValueError('Empty or duplicate profile set')
 records=[];seen={'vpn-admin'}
 for r in rows:
  login=r['email'];normalized=login.strip().lower()
  if not normalized or len(login)>80 or normalized in seen:raise ValueError('Duplicate or reserved login')
  seen.add(normalized)
  p=by_name.get(login)
  # First import requires an exact, healthy profile inventory. Never invent links.
  if not p or p['uuid']!=r['uuid'] or p['subId']!=r['sub_id']:raise ValueError('Panel/profile inventory mismatch')
  if not re.fullmatch(r'[A-Za-z0-9_-]+',r['sub_id']):raise ValueError('Unsupported profile identifier')
  expires=r['expiry_time'];devices=r['limit_ip']
  if expires<0 or not 0<=devices<=1000:raise ValueError('Unsupported existing limits')
  records.append(dict(login=login,panelLogin=login,profileUrl='https://sub.family-pie.ru/sub/'+r['sub_id'],expiresAt=expires,unlimited=expires==0,enabled=bool(r['enable']),devices=devices))
 if len(by_name)!=len(records):raise ValueError('Profile inventory count mismatch')
 fd=os.open(output_path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump(records,f,ensure_ascii=False)
 return len(records)

if __name__=='__main__':
 try:
  count=export('/etc/x-ui/x-ui.db','/opt/submerge/config.json',sys.argv[1])
  print(json.dumps({'validatedAccounts':count}))
 except Exception:
  raise SystemExit('Private import preflight failed; no customer data logged')
