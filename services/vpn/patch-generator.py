#!/usr/bin/env python3
"""Install only the reviewed active-client filter; refuse unknown source shapes."""
from pathlib import Path
p=Path('/opt/submerge/gen_config.py');s=p.read_text()
if '# Cabinet active-profile filter' in s:raise SystemExit(0)
old='SELECT email, sub_id, uuid FROM clients '
append='clients.append({"name": r["email"], "uuid": r["uuid"], "subId": r["sub_id"]})'
marker='# --- Nodes '
if old not in s or append not in s or marker not in s:raise SystemExit('Unknown generator source; refused')
s=s.replace(old,'SELECT email, sub_id, uuid, enable, expiry_time FROM clients ')
s=s.replace(append,'clients.append({"name": r["email"], "uuid": r["uuid"], "subId": r["sub_id"], "_active": bool(r["enable"]) and (r["expiry_time"] <= 0 or r["expiry_time"] > int(time.time()*1000))})')
s=s.replace(marker,'# Cabinet active-profile filter: count guard above still checks every identity.\nclients = [c for c in clients if c.pop("_active")]\n\n'+marker,1)
s=s.replace('\n','\nimport time\n',1);compile(s,str(p),'exec');p.write_text(s)
