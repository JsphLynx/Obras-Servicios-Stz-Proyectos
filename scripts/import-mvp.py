import json,sys
from pathlib import Path
x=json.load(open(sys.argv[1]));out=Path(sys.argv[2]);q=lambda s:"'"+str(s).replace("'","''")+"'"
def value(v):
 if v is None:return 'NULL'
 if isinstance(v,bool):return 'true' if v else 'false'
 if isinstance(v,(float,int)):return str(v)
 return q(v)
def ins(table,row):return f"INSERT INTO {table} ({','.join(row)}) OVERRIDING SYSTEM VALUE VALUES ({','.join(v if isinstance(v,Expr) else value(v) for v in row.values())});"
class Expr(str):pass
cats={'origen_proyecto':['PLAN_MUNICIPAL','DEMANDA_CIUDADANA','CONSERVACION'],'estado_proyecto':['PLANIFICADO','EN_EJECUCION','FINALIZADO','ANULADO'],'departamento':['OBRAS_Y_SERVICIOS','MEDIO_AMBIENTE','DEPORTES'],'tipo_actuacion':['OBRA','SUMINISTRO','SERVICIO','ESTUDIO','MANTENIMIENTO'],'estado_actuacion':['PLANIFICADO','EN_EJECUCION','FINALIZADO','ANULADO'],'tipo_elemento':['EDIFICIO','INSTALACION'],'tipo_contrato':['OBRAS','SUMINISTROS','SERVICIOS','CONCESION_SERVICIOS','CONCESION_OBRAS','MIXTO'],'tipo_gasto':['CERTIFICACION','SUMINISTRO','SERVICIO','COSTE_INTERNO']}
def remap(r):
 for key,v in list(r.items()):
  name='departamento' if key=='id_departamento_responsable' else key[3:]
  if key.startswith('id_') and name in cats:r[key]=Expr(f'(SELECT id_{name} FROM catalogo.{name} WHERE codigo={q(cats[name][v-1])})')
 return r
statements=["SELECT pg_advisory_xact_lock(6284019)","SET CONSTRAINTS ALL DEFERRED"]
seq=[]
for src,dest,pk in [('proyectos','gestion.proyectos','id_proyecto'),('inmuebles','patrimonio.fichas_lm_em','id_ficha_lm_em'),('proyecto_inmuebles','gestion.proyecto_fichas',None),('emplazamientos','gis.emplazamientos','id_emplazamiento'),('proyecto_emplazamientos','gestion.proyecto_emplazamientos','id_proyecto_emplazamiento'),('actuaciones','gestion.actuaciones','id_actuacion'),('expedientes','contratacion.expedientes','id_expediente'),('lotes','contratacion.lotes','id_lote'),('gastos','economico.gastos_ficha','id_gasto'),('actuacion_gastos','gestion.actuacion_gastos','id_actuacion_gasto')]:
 for row in x[src]:
  r=remap(dict(row))
  if src=='emplazamientos':
   r['id_tipo_emplazamiento']=Expr(f"(SELECT id_tipo_emplazamiento FROM catalogo.tipo_emplazamiento WHERE codigo={q(r.pop('tipo'))})");r.pop('geometria')
  if src=='expedientes':
   for a,b in [('intelectual','prestacion_intelectual'),('anexo_iv','servicios_anexo_iv'),('prorrogas','preve_prorroga')]:r[b]=bool(r.pop(a))
   r['porcentaje_juicio_valor']=r.pop('juicio_valor')
  if src=='lotes':
   e=next(e for e in x['expedientes'] if e['id_expediente']==r['id_expediente'])
   r['numero_lote']=r.pop('numero');r['presupuesto_base_sin_iva']=r.pop('importe_sin_iva');r.update({k:e[k] for k in ['objeto','valor_estimado_sin_iva','iva_presupuesto','estado']})
  if src=='gastos':project=r.pop('id_proyecto');r['pagado']=bool(r['pagado'])
  statements.append(ins(dest,r))
  if src=='gastos':statements.append(ins('gestion.proyecto_gastos',dict(id_proyecto=project,id_gasto=r['id_gasto'],importe_imputado=r['importe'],criterio_reparto='Importación íntegra desde el MVP')))
 if pk:seq.append((dest,pk))
order=['stz_contracts','stz_contract_projects','stz_budgets','stz_items','stz_measurements','stz_certificates','stz_certificate_lines','stz_assets','stz_plans','stz_incidents','stz_orders','stz_resources','stz_invoices','stz_invoice_lines','stz_payments','stz_milestones','stz_forecasts','stz_receipts','stz_documents','stz_obligations','stz_audit']
for t in order:
 for r in x[t]:statements.append(ins('operativa_stz.'+t,r))
 seq.append(('operativa_stz.'+t,'id'))
for table,pk in seq:statements.append(f"SELECT setval(pg_get_serial_sequence('{table}','{pk}'),greatest(coalesce((SELECT max({pk}) FROM {table}),0)+1,1),false)")
statements.append("SET CONSTRAINTS ALL IMMEDIATE")
statements.append("INSERT INTO app_stz.schema_migrations(version) VALUES ('consolidacion-20261019')")
out.write_text(';\n'.join(s.rstrip(';') for s in statements)+';\n');print('Prepared',len(statements),'import statements')
