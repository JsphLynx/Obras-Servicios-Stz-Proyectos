"""Read-only audit of an exported Neon snapshot; no database writes.

Usage: python scripts/review-demo-examples.py <snapshot.json> <output.json>
The snapshot contains data, overview and schema as obtained through Neon SELECTs.
"""
import hashlib
import json
import sys
from collections import Counter
from decimal import Decimal
from pathlib import Path

x = json.loads(Path(sys.argv[1]).read_text())
d, overview = x['data'], x['overview']
checks = []
def check(name, condition, project=None):
    checks.append(dict(name=name, project_id=project, ok=bool(condition)))
def index(key):
    return {r['id']: r for r in d[key]}
def base(r):
    return (r['quantity_milli'] * r['unit_cents'] + 500) // 1000
def gross(r):
    b = base(r)
    return b + (b * r['vat_bps'] + 5000) // 10000
items, budgets, measurements = index('items'), index('budgets'), index('measurements')
contracts, invoices, orders, certs = (index(k) for k in ['contracts','invoices','orders','certificates'])
check('Exactly ten reference projects and ten manuals', len(d['proyectos']) == len(overview['casos']) == 10)
check('Unique codes DEMO-001 to DEMO-010', {p['codigo_proyecto'] for p in d['proyectos']} == {f'DEMO-{n:03}' for n in range(1,11)})
check('37 protected tables / 475 protected rows', len({r['tabla'] for r in d['protected']}) == 37 and len(d['protected']) == 475)
for table in {r['tabla'] for r in d['protected']}:
    triggers = [r for r in d['triggers'] if r['table']==table and r['enabled']=='O']
    check(f'{table}: active row and truncate guards', {r['name'] for r in triggers} >= {'a00_demo_protegido','a00_demo_no_truncate'})
rows = []
for p in sorted(d['proyectos'], key=lambda p:p['id_proyecto']):
    pid=p['id_proyecto']
    c=next(c for c in overview['casos'] if c['project_id']==pid)
    coverage=next(c for c in overview['cobertura'] if c['id_proyecto']==pid)
    economy=next(c for c in overview['economia'] if c['project_id']==pid)
    bs=[b for b in d['budgets'] if b['project_id']==pid and b['status']=='APROBADO']
    its=[i for i in d['items'] if i['budget_id'] in {b['id'] for b in bs}]
    ms=[m for m in d['measurements'] if m['item_id'] in {i['id'] for i in its}]
    fs=[f for f in d['invoices'] if f['project_id']==pid and f['status']=='REGISTRADA']
    lines=[l for l in d['invoice_lines'] if l['invoice_id'] in {f['id'] for f in fs}]
    payments=[a for a in d['payments'] if a['invoice_id'] in {f['id'] for f in fs}]
    os=[o for o in d['orders'] if o['project_id']==pid]
    internal=sum(base(r) for r in d['resources'] if r['order_id'] in {o['id'] for o in os if o['contract_id'] is None})
    docs=[a for a in d['documents'] if a['project_id']==pid and any(t['document_id']==a['id'] for t in d['demo_documentos_contenido'])]
    facturado=sum(l['base_cents']+l['vat_cents'] for l in lines)
    pagado=sum(a['amount_cents'] for a in payments)
    check('One approved budget',len(bs)==1,pid)
    check('Approved item count matches reference',len(its)==c['esperado']['partidas']==coverage['partidas_aprobadas'],pid)
    check('Nonempty synthetic manual with correct project title',bool(c['manual_md'].strip()) and p['codigo_proyecto'] in c['manual_md'] and c['sintetico'],pid)
    check('Four downloadable synthetic documents',len(docs)==4,pid)
    check('Invoice totals match reference and SQL view',facturado==c['esperado']['facturado_cents']==economy['facturado_cents'],pid)
    check('Payments match reference and SQL view',pagado==c['esperado']['pagado_cents']==economy['pagado_cents'],pid)
    check('Internal cost matches reference and SQL view',internal==c['esperado']['coste_interno_cents']==economy['coste_interno_cents'],pid)
    check('Balance and no duplicate legacy costs',facturado-pagado==economy['saldo_facturas_cents'] and economy['legado_no_conciliado_cents']==0 and facturado+internal==economy['coste_sin_duplicados_cents'],pid)
    check('Case state matches reference',coverage['estado']==c['esperado']['estado'],pid)
    check('Closed case has full measurement and no unpaid balance',coverage['estado']!='FINALIZADO' or (all(sum(m['quantity_milli'] for m in ms if m['item_id']==i['id'])==i['quantity_milli'] for i in its) and facturado==pagado),pid)
    for i in its:
        check(f"{i['code']}: measured quantity within approved quantity",0<=sum(m['quantity_milli'] for m in ms if m['item_id']==i['id'])<=i['quantity_milli'],pid)
    check('Measurement dates do not exceed reference cutoff',all(m['measured_on']<=c['fecha_corte'] for m in ms),pid)
    check('Future milestones do not claim completion',all(not h['actual_on'] or h['actual_on']<=c['fecha_corte'] for h in d['milestones'] if h['project_id']==pid),pid)
    check('External contract or correctly exempt internal brigade',(coverage['contratos_con_adjudicacion']>0) if pid!=10 else (coverage['contratos_con_adjudicacion']==0 and not fs and not payments and internal==2500000),pid)
    for a in docs:
        content=next(t['contenido'] for t in d['demo_documentos_contenido'] if t['document_id']==a['id'])
        check(f"Document {a['id']}: content and synthetic notice",bool(content) and 'SINTÉTICOS' in content,pid)
        check(f"Document {a['id']}: SHA256 and byte count",a['sha256']==hashlib.sha256(content.encode()).hexdigest() and a['size_bytes']==len(content.encode()),pid)
    rows.append(dict(project_id=pid,code=p['codigo_proyecto'],name=p['nombre'],state=coverage['estado'],planning_cents=int(Decimal(str(p['presupuesto_proyecto']))*100),approved_budget_cents=sum(gross(i) for i in its),invoice_cents=facturado,paid_cents=pagado,balance_cents=facturado-pagado,internal_cents=internal,coverage=coverage))
for c in d['contracts']:
    a=next((a for a in d['web_awards'] if a['id']==c['id_adjudicacion']),None)
    check(f"Contract {c['id']}: matching award",a and a['contract_id']==c['id'] and a['base_cents']==c['base_cents'] and a['supplier']==c['supplier'])
    its=[i for i in d['items'] if i['contract_id']==c['id'] and budgets[i['budget_id']]['status']=='APROBADO']
    check(f"Contract {c['id']}: budget allocation without double counting",sum(base(i) for i in its)==c['base_cents'])
for f in d['invoices']:
    pid=f['project_id']
    check(f"Invoice {f['id']}: contract linked to project",any(l['project_id']==pid and l['contract_id']==f['contract_id'] for l in d['contract_projects']),pid)
    ls=[l for l in d['invoice_lines'] if l['invoice_id']==f['id']]
    total=sum(l['base_cents']+l['vat_cents'] for l in ls)
    paid=sum(p['amount_cents'] for p in d['payments'] if p['invoice_id']==f['id'])
    check(f"Invoice {f['id']}: registered, dated and payable balance",f['status']=='REGISTRADA' and f['issued_on']<='2026-10-20' and 0<=paid<=total,pid)
    for l in ls:
        check(f"Invoice line {l['id']}: exactly one source",bool(l['certificate_id'])!=bool(l['order_id']),pid)
        if l['certificate_id']:
            c=certs[l['certificate_id']]
            cms=[measurements[cl['measurement_id']] for cl in d['certificate_lines'] if cl['certificate_id']==c['id']]
            value=sum((m['quantity_milli']*items[m['item_id']]['unit_cents']+500)//1000 for m in cms)
            check(f"Invoice line {l['id']}: valid certificate, project, contract and amount",c['status']=='VALIDADA' and c['project_id']==pid and c['contract_id']==f['contract_id'] and value==l['base_cents'],pid)
        if l['order_id']:
            o=orders[l['order_id']]
            check(f"Invoice line {l['id']}: closed order, project, contract and amount",o['status']=='CERRADA' and o['project_id']==pid and o['contract_id']==f['contract_id'] and sum(base(r) for r in d['resources'] if r['order_id']==o['id'])==l['base_cents'],pid)
for mid, count in Counter(l['measurement_id'] for l in d['certificate_lines']).items():
    check(f'Measurement {mid}: certified once',count==1)
result=dict(date='2026-10-23',data_cutoff='2026-10-20',scope='V1-01 and V1-03: reference examples and manuals; no real-user form tests',checks=checks,passed=sum(c['ok'] for c in checks),failed=sum(not c['ok'] for c in checks),cases=rows)
Path(sys.argv[2]).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':result['passed'],'failed':result['failed'],'failures':[c for c in checks if not c['ok']]},ensure_ascii=False))
sys.exit(1 if result['failed'] else 0)
