import {forms} from './forms';
import {reviewedDemoManuals} from './demo-manuals';
import {all,readBatch,one,db,insert,mutate,today,stamp,scaled,type Row} from './db';
const id=(v:any)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1)throw Error('Identificador no válido');return n;};
const txt=(v:any)=>{const s=String(v??'').trim();if(!s||s.length>4000)throw Error('Completa la información obligatoria (máximo 4000 caracteres)');return s;};
const date=(v:any)=>{const s=String(v??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||isNaN(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Fecha no válida');return s;};
const tables={contracts:'stz_contracts',contractLinks:'stz_contract_projects',budgets:'stz_budgets',items:'stz_items',measurements:'stz_measurements',certificates:'stz_certificates',certificateLines:'stz_certificate_lines',assets:'stz_assets',plans:'stz_plans',incidents:'stz_incidents',orders:'stz_orders',resources:'stz_resources',invoices:'stz_invoices',invoiceLines:'stz_invoice_lines',payments:'stz_payments',milestones:'stz_milestones',forecasts:'stz_forecasts',receipts:'stz_receipts',documents:'stz_documents',obligations:'stz_obligations'};
export async function overview(){
 const entries=Object.entries(tables);
 const rows=await readBatch([...entries.map(([k,t])=>k==='documents'?'SELECT d.*,EXISTS(SELECT 1 FROM app_stz.demo_documentos_contenido c WHERE c.document_id=d.id) has_content FROM stz_documents d ORDER BY id DESC':'SELECT * FROM '+t+' ORDER BY id DESC'),'SELECT * FROM app_stz.web_awards ORDER BY id','SELECT project_id,version,fecha_corte::text,manual_md FROM app_stz.demo_casos ORDER BY project_id','SELECT * FROM stz_audit ORDER BY id DESC LIMIT 300']);
 const manuals=rows[entries.length+1].map(row=>{const reviewed=reviewedDemoManuals[row.project_id];return reviewed&&reviewed.source_version===row.version&&reviewed.data_cutoff===row.fecha_corte?{...row,manual_md:reviewed.manual_md,version:reviewed.version}:row;});
 return {...Object.fromEntries(entries.map(([k],i)=>[k,rows[i]])),awards:rows[entries.length],manuals,audit:rows[entries.length+2],date:today()};
}
export async function command(kind:string,raw:Row,actor:string){
 const reason=String(raw.audit_reason||raw.reason||'Operación del piloto Santurtzi').slice(0,4000);
 if(kind==='contract'){
  const a=await one('SELECT * FROM app_stz.web_awards WHERE id=? AND vigente AND contract_id IS NULL AND estado IN (\'ADJUDICADO\',\'EN_EJECUCION\',\'FINALIZADO\')',[id(raw.id_adjudicacion)]);
  if(!a)throw Error('Selecciona una adjudicación vigente sin contrato operativo');
  const start=date(raw.start_on),end=date(raw.end_on);if(end<start)throw Error('Fin anterior al inicio');
  const vat=a.base_cents?Math.round(a.vat_cents*10000/a.base_cents):0;
  await mutate(actor,reason,[db().prepareAtomic(`WITH nuevo AS (INSERT INTO operativa_stz.stz_contracts(code,name,supplier,kind,base_cents,vat_bps,start_on,end_on,reference,id_adjudicacion) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id), linked AS (INSERT INTO operativa_stz.stz_contract_projects(contract_id,project_id,role) SELECT id,?,'Proyecto principal del expediente' FROM nuevo RETURNING 1) SELECT app_stz.require_change(count(*)) affected FROM linked`).bind(txt(raw.code),a.object,a.supplier,a.kind,a.base_cents,vat,start,end,txt(raw.reference),a.id,a.project_id)]);
  return {ok:true};
 }
 if(forms[kind]){
  const spec=forms[kind],v:Row={};
  for(const f of spec.fields){const x=raw[f.key];if(x===''||x==null){if(f.required)throw Error('Completa: '+f.label);v[f.key]=null;continue;}v[f.key]=f.relation?id(x):f.type==='money'?scaled(x,2):f.key==='vat_bps'?scaled(x,2):f.type==='quantity'?scaled(x,3):f.type==='number'?id(x):f.type==='date'?date(x):txt(x);if(f.options&&!f.options.includes(v[f.key]))throw Error('Opción no válida: '+f.label);}
  for(const k of ['base_cents','unit_cents','expected_cents','total_cents'])if(k in v&&v[k]<0&&!['invoice_line'].includes(kind))throw Error('El importe no puede ser negativo');
  if('vat_bps' in v&&(v.vat_bps<0||v.vat_bps>10000))throw Error('IVA fuera de rango');
  if(v.quantity_milli!=null&&(v.quantity_milli<=0||v.quantity_milli>100000000))throw Error('Cantidad fuera de rango');
  if(v.unit_cents>1000000000)throw Error('Precio unitario fuera de rango');
  if(v.start_on&&v.end_on&&v.end_on<v.start_on)throw Error('El fin no puede ser anterior al inicio');
  if(v.period_start&&v.period_end<v.period_start)throw Error('Periodo no válido');
  if(v.reported_on&&v.due_on<v.reported_on)throw Error('El plazo no puede preceder al aviso');
  if(v.warranty_until&&v.warranty_until<v.received_on)throw Error('La garantía no puede finalizar antes de la recepción');
  if(kind==='receipt'&&v.result==='CON_DEFECTOS'&&(!v.correction_due||v.correction_due<v.received_on))throw Error('Indica el plazo de subsanación');
  if(['certificate','receipt'].includes(kind)&&!await one('SELECT id FROM stz_contract_projects WHERE project_id=? AND contract_id=?',[v.project_id,v.contract_id]))throw Error('Vincula el contrato al proyecto');
  if(kind==='invoice_line'&&Number(!!v.order_id)+Number(!!v.certificate_id)!==1)throw Error('Selecciona solo una fuente: certificación u orden cerrada');
  if(kind==='order'&&v.incident_id&&!await one('SELECT id FROM stz_incidents WHERE id=? AND project_id=? AND asset_id=? AND status<>\'RESUELTA\'',[v.incident_id,v.project_id,v.asset_id]))throw Error('Incidencia incompatible con el activo o proyecto');
  if(kind==='incident'&&!await one('SELECT 1 FROM stz_assets a JOIN proyecto_emplazamientos pe ON pe.id_emplazamiento=a.location_id WHERE a.id=? AND pe.id_proyecto=?',[v.asset_id,v.project_id]))throw Error('Vincula el emplazamiento del activo al proyecto');
  if(kind==='obligation'){const u=new URL(v.source_url);if(u.protocol!=='https:')throw Error('Usa una URL HTTPS de la fuente');}
  if(['measurement','certificate','incident','invoice','payment','forecast','receipt','document'].includes(kind))v.actor=actor;
  if(['measurement','forecast','document'].includes(kind))v.created_at=stamp();
  if(raw.id){
   if(!['item','obligation','plan'].includes(kind))throw Error('Este formulario solo admite altas');
   if(kind==='item'){const old=await one('SELECT * FROM stz_items WHERE id=?',[id(raw.id)]);if(!old||old.budget_id!==v.budget_id)throw Error('No se puede trasladar una partida entre presupuestos');}
   if(kind==='plan')return checkedUpdate(spec.table,id(raw.id),Object.keys(v).map(k=>k+'=?').join(',')+',version=version+1',Object.values(v),'version=?',[id(raw.version)],actor,reason);
   await mutate(actor,reason,[db().prepare(`UPDATE ${spec.table} SET ${Object.keys(v).map(k=>k+'=?').join(',')} WHERE id=?`).bind(...Object.values(v),id(raw.id))]);
  }else await mutate(actor,reason,[insert(spec.table,v)]);
  return {ok:true};
 }
 if(kind==='new_budget'){
  const p=id(raw.project_id),revision=Number((await one('SELECT coalesce(max(revision),0)+1 n FROM stz_budgets WHERE project_id=?',[p])).n);
  if(await one("SELECT id FROM stz_budgets WHERE project_id=? AND status='BORRADOR'",[p]))throw Error('Completa el borrador existente antes de crear otro');
  const previous=await one("SELECT id FROM stz_budgets WHERE project_id=? AND status='APROBADO' ORDER BY revision DESC LIMIT 1",[p]);
  const ops=[insert('stz_budgets',{project_id:p,revision,status:'BORRADOR',reason:txt(raw.reason),reference:txt(raw.reference),actor,created_at:stamp()})];
  if(previous)ops.push(db().prepare('INSERT INTO stz_items(budget_id,action_id,contract_id,chapter,code,description,unit,quantity_milli,unit_cents,vat_bps,start_on,end_on,budget_application) SELECT (SELECT id FROM stz_budgets WHERE project_id=? AND revision=?),action_id,contract_id,chapter,code,description,unit,quantity_milli,unit_cents,vat_bps,start_on,end_on,budget_application FROM stz_items WHERE budget_id=?').bind(p,revision,previous.id));
  await mutate(actor,reason,ops);return {ok:true};
 }
 if(kind==='approve_budget')return checkedUpdate('stz_budgets',id(raw.id),"status='APROBADO',approved_on=?,reference=?,actor=?",[date(raw.approved_on||today()),txt(raw.reference),actor],"status='BORRADOR'",[],actor,reason);
 if(kind==='validate_certificate')return checkedUpdate('stz_certificates',id(raw.id),"status='VALIDADA',validated_on=?,reference=?,actor=?",[today(),txt(raw.reference),actor],"status='BORRADOR'",[],actor,reason);
 if(kind==='post_invoice')return checkedUpdate('stz_invoices',id(raw.id),"status='REGISTRADA',actor=?",[actor],"status='BORRADOR'",[],actor,reason);
 if(kind==='change_contract'){
  const cents=scaled(raw.base_cents,2);if(cents<0)throw Error('Importe no válido');const end=date(raw.end_on);return checkedUpdate('stz_contracts',id(raw.id),'base_cents=?,end_on=?,reference=?,version=version+1',[cents,end,txt(raw.reference)],'version=?',[id(raw.version)],actor,txt(raw.reason));
 }
 if(kind==='generate_order'){
  const p=await one('SELECT * FROM stz_plans WHERE id=? AND active=1',[id(raw.id)]);if(!p)throw Error('Plan no disponible');
  const next=new Date(p.next_due+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+p.frequency_days);
  const values:Row={project_id:p.project_id,asset_id:p.asset_id,contract_id:p.contract_id,plan_id:p.id,code:'OT-P'+p.id+'-'+p.next_due,description:p.name+' · '+p.checklist,responsible:p.responsible,due_on:p.next_due,expected_cents:0};
  const inserted=db().prepare(`INSERT INTO stz_orders (${Object.keys(values).join(',')}) SELECT ${Object.keys(values).map(()=>'?').join(',')} WHERE EXISTS(SELECT 1 FROM stz_plans WHERE id=? AND version=?)`).bind(...Object.values(values),p.id,p.version);
  const results=await mutate(actor,'Generación de vencimiento preventivo',[inserted,db().prepare('UPDATE stz_plans SET next_due=?,version=version+1 WHERE id=? AND version=?').bind(next.toISOString().slice(0,10),p.id,p.version)]);if(!results[1].meta.changes)throw Error('El plan cambió. Actualiza antes de generar otra orden.');return {ok:true};
 }
 if(kind==='order_transition'){
  const o=await one('SELECT * FROM stz_orders WHERE id=?',[id(raw.id)]);if(!o)throw Error('Orden inexistente');
  const transitions:Record<string,string[]>={ABIERTA:['EN_CURSO'],EN_CURSO:['PENDIENTE_VALIDACION'],PENDIENTE_VALIDACION:['CERRADA','EN_CURSO'],CERRADA:['REABIERTA'],REABIERTA:['EN_CURSO']};
  const next=txt(raw.status);if(!transitions[o.status]?.includes(next))throw Error('Transición de estado no permitida');
  const fields:Row={status:next};
  if(next==='EN_CURSO')fields.start_on=o.start_on||date(raw.date||today());
  if(next==='PENDIENTE_VALIDACION'){fields.finished_on=date(raw.date||today());if(fields.finished_on<(o.start_on||'0000'))throw Error('Fin anterior al inicio');fields.result=txt(raw.result);fields.evidence=txt(raw.evidence);}
  if(next==='CERRADA'){fields.checked_by=actor;fields.checked_on=today();}
  if(next==='REABIERTA'){txt(raw.reason);fields.checked_by=null;fields.checked_on=null;fields.finished_on=null;}
  const ops=[db().prepare(`UPDATE stz_orders SET ${Object.keys(fields).map(k=>k+'=?').join(',')},version=version+1 WHERE id=? AND version=?`).bind(...Object.values(fields),o.id,id(raw.version))];
  if(o.incident_id)ops.push(db().prepare("UPDATE stz_incidents SET status=CASE WHEN EXISTS(SELECT 1 FROM stz_orders WHERE incident_id=? AND status<>'CERRADA') THEN 'EN_TRATAMIENTO' ELSE 'RESUELTA' END WHERE id=?").bind(o.incident_id,o.incident_id));
  const result=await mutate(actor,reason,ops);if(!result[1].meta.changes)throw Error('La orden cambió. Actualiza antes de continuar.');return {ok:true};
 }
 if(kind==='update_milestone')return checkedUpdate('stz_milestones',id(raw.id),'forecast_on=?,actual_on=?,reason=?,reference=?,version=version+1',[date(raw.forecast_on),raw.actual_on?date(raw.actual_on):null,txt(raw.reason),txt(raw.reference)],'version=?',[id(raw.version)],actor,txt(raw.reason));
 if(kind==='correct_receipt')return checkedUpdate('stz_receipts',id(raw.id),"corrected_on=?,reference=?,version=version+1",[date(raw.corrected_on),txt(raw.reference)],'version=?',[id(raw.version)],actor,txt(raw.reason));
 if(kind==='delete_draft_line'){const table=raw.entity==='invoice'?'stz_invoice_lines':raw.entity==='certificate'?'stz_certificate_lines':null;if(!table)throw Error('Entidad no válida');await mutate(actor,txt(raw.reason),[db().prepare(`DELETE FROM ${table} WHERE id=?`).bind(id(raw.id))]);return {ok:true};}
 if(kind==='remove_measurement'){await mutate(actor,txt(raw.reason),[db().prepare('DELETE FROM stz_measurements WHERE id=?').bind(id(raw.id))]);return {ok:true};}
 throw Error('Operación no reconocida');
}
async function checkedUpdate(table:string,record:number,set:string,values:any[],condition:string,checks:any[],actor:string,reason:string){const results=await mutate(actor,reason,[db().prepare(`UPDATE ${table} SET ${set} WHERE id=? AND ${condition}`).bind(...values,record,...checks)]);if(!results[1].meta.changes)throw Error('El registro cambió o ya no admite esta operación. Actualiza.');return {ok:true};}
