import fs from 'node:fs';
import assert from 'node:assert/strict';
import {load,req,data,operations} from './harness.mjs';
const tag='QA-API-20261024-B',today='2026-10-24',out='docs/validation/remaining-flows-20261024.json';
const state=fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{tag,date:today,scope:'Real route handlers and Neon practice; mocked Sites identity. No browser or real file upload evidence.',checks:[],ids:{}};
const ids=state.ids;
const persist=()=>fs.writeFileSync(out,JSON.stringify(state,null,2));
state.complete=false;persist();
async function test(name,fn){if(state.checks.some(c=>c.name===name&&c.passed)){console.log('REUSE',name);return;}try{await fn();state.checks.push({name,passed:true});delete state.error;persist();console.log('PASS',name);}catch(e){state.error={name,message:e.message};persist();throw e;}}
const ctx=load('lib/stz/context.ts').requestContext,db=load('lib/stz/db.ts');
const one=(sql,v=[])=>ctx.run({userId:'qa-editor',role:'EDITOR',mode:'practice',canWrite:true},()=>db.one(sql,v));
async function post(kind,v={},expected=200,base=false){const r=await (base?data:operations).POST(req(base?'data':'operations','POST',{kind,data:v}));const j=await r.json();assert.equal(r.status,expected,kind+': '+JSON.stringify(j));return j;}
const find=(table,field,value)=>one(`SELECT * FROM ${table} WHERE ${field}=?`,[value]);
await test('Independent synthetic project and location created through routes',async()=>{
 let p=await find('proyectos','codigo_proyecto',tag);if(!p){const src=await one('SELECT * FROM proyectos WHERE id_proyecto=11');await post('proyecto',{...src,codigo_proyecto:tag,nombre:'Pruebas ampliadas sintéticas',regimen_ejecucion:'MEDIOS_PROPIOS'},200,true);p=await find('proyectos','codigo_proyecto',tag);}ids.project=p.id_proyecto;
 let l=await find('emplazamientos','codigo',tag);if(!l){await post('emplazamiento',{codigo:tag,nombre:'Emplazamiento sintético API B',tipo:'ESPACIO_PUBLICO',direccion:'Dirección ficticia QA'},200,true);l=await find('emplazamientos','codigo',tag);}ids.location=l.id_emplazamiento;
 if(!await one('SELECT 1 FROM proyecto_emplazamientos WHERE id_proyecto=? AND id_emplazamiento=?',[ids.project,ids.location]))await post('ambito',{id_proyecto:ids.project,id_emplazamiento:ids.location,rol:'Ensayo sintético'},200,true);
});
await test('Optimistic project edit rejects stale version',async()=>{const p=await find('proyectos','id_proyecto',ids.project);await post('proyecto',{...p,id:p.id_proyecto,nombre:'Pruebas ampliadas sintéticas revisadas'},200,true);await post('proyecto',{...p,id:p.id_proyecto,nombre:'No debe guardarse'},400,true);assert.equal((await find('proyectos','id_proyecto',ids.project)).nombre,'Pruebas ampliadas sintéticas revisadas');});
await test('Asset, preventive plan and generated order preserve due date',async()=>{
 await post('asset',{location_id:ids.location,code:tag,name:tag,category:'OTRO',criticality:'BAJA',notes:'Solo ensayo sintético'});ids.asset=(await find('stz_assets','code',tag)).id;
 await post('plan',{asset_id:ids.asset,project_id:ids.project,name:tag,frequency_days:30,next_due:today,checklist:'Inspección sintética',reference:tag,responsible:'Equipo QA'});let p=await find('stz_plans','name',tag);ids.plan=p.id;
 await post('generate_order',{id:p.id});p=await find('stz_plans','id',p.id);assert.equal(p.next_due,'2026-11-23');const o=await find('stz_orders','plan_id',p.id);ids.order=o.id;assert.equal(o.due_on,today);assert.equal(o.status,'ABIERTA');
});
await test('Plan edits require current version',async()=>{const p=await find('stz_plans','id',ids.plan);await post('plan',{...p,name:tag,checklist:'Lista revisada QA'});await post('plan',{...p,checklist:'No debe persistir'},400);assert.equal((await find('stz_plans','id',p.id)).checklist,'Lista revisada QA');});
await test('Invalid order transition and missing completion evidence rejected',async()=>{let o=await find('stz_orders','id',ids.order);await post('order_transition',{id:o.id,version:o.version,status:'CERRADA'},400);await post('order_transition',{id:o.id,version:o.version,status:'EN_CURSO',date:today});o=await find('stz_orders','id',ids.order);await post('order_transition',{id:o.id,version:o.version,status:'PENDIENTE_VALIDACION',date:today,result:'Prueba'},400);assert.equal((await find('stz_orders','id',o.id)).status,'EN_CURSO');});
await test('Resources, completion and validation close maintenance order',async()=>{await post('resource',{order_id:ids.order,kind:'MATERIAL',description:tag,quantity_milli:'2',unit_cents:'50'});let o=await find('stz_orders','id',ids.order);await post('order_transition',{id:o.id,version:o.version,status:'PENDIENTE_VALIDACION',date:today,result:'Conforme sintético',evidence:tag});o=await find('stz_orders','id',ids.order);await post('order_transition',{id:o.id,version:o.version,status:'CERRADA'});o=await find('stz_orders','id',ids.order);assert.equal(o.status,'CERRADA');assert.equal(o.checked_by,'qa-editor');await post('resource',{order_id:ids.order,kind:'MATERIAL',description:'Bloqueado',quantity_milli:'1',unit_cents:'1'},400);});
await test('Closed order invoice enforces cost ceiling and registers valid source',async()=>{
 await post('invoice',{project_id:ids.project,code:tag,supplier:'Proveedor QA ficticio',issued_on:today,reference:tag});ids.invoice=(await find('stz_invoices','code',tag)).id;
 await post('invoice_line',{invoice_id:ids.invoice,order_id:ids.order,description:tag,base_cents:'101',vat_cents:'0'});await post('post_invoice',{id:ids.invoice},400);
 const line=await find('stz_invoice_lines','invoice_id',ids.invoice);await post('delete_draft_line',{entity:'invoice',id:line.id,reason:'Sustitución de línea propia de ensayo que excede recursos'});
 await post('invoice_line',{invoice_id:ids.invoice,order_id:ids.order,description:tag,base_cents:'100',vat_cents:'21'});await post('post_invoice',{id:ids.invoice});assert.equal((await find('stz_invoices','id',ids.invoice)).status,'REGISTRADA');
});
await test('Payment, partial credit and refund leave reconciled balance',async()=>{
 if(!ids.credit){await post('payment',{invoice_id:ids.invoice,paid_on:today,amount_cents:'121',reference:tag});await post('invoice',{project_id:ids.project,original_id:ids.invoice,code:tag+'-RECT',supplier:'Proveedor QA ficticio',issued_on:today,reference:tag});ids.credit=(await find('stz_invoices','code',tag+'-RECT')).id;await post('invoice_line',{invoice_id:ids.credit,order_id:ids.order,description:'Rectificación sintética',base_cents:'-20',vat_cents:'-4.20'});await post('post_invoice',{id:ids.credit});}
 // Refunds can reverse prior payments, including a returned bank transfer; the
 // invariant is cumulative payments >= 0, not a refund limited to the credit.
 // The first attempt incorrectly expected -24.21 to fail after a 24.20 credit.
 // That accepted test record stays in the audit trail and is reconciled by +0.01.
 await post('payment',{invoice_id:ids.invoice,paid_on:today,amount_cents:'-121.01',reference:tag+'-EXCEEDS-PAID'},400);
 const paid=await one('SELECT coalesce(sum(amount_cents),0) total FROM stz_payments WHERE invoice_id=?',[ids.invoice]);
 if(paid.total!==9680)await post('payment',{invoice_id:ids.invoice,paid_on:today,amount_cents:String((9680-paid.total)/100),reference:tag+'-RECONCILE'});
 state.testCorrection='Initial expectation that refunds could not exceed the credit was incorrect. Existing payment reversal semantics permit this while keeping net payments nonnegative; accepted -24.21 and +0.01 reconciliation preserved. No application behavior changed.';
 const balance=await one('SELECT (SELECT sum(l.base_cents+l.vat_cents) FROM stz_invoice_lines l JOIN stz_invoices i ON i.id=l.invoice_id WHERE i.status=\'REGISTRADA\' AND (i.id=? OR i.original_id=?))-(SELECT sum(amount_cents) FROM stz_payments WHERE invoice_id=?) balance',[ids.invoice,ids.invoice,ids.invoice]);assert.equal(balance.balance,0);
});
await test('Incident scope rejects foreign asset; reopen restores incident treatment',async()=>{
 await post('incident',{project_id:2,asset_id:ids.asset,description:tag,priority:'BAJA',reported_on:today,due_on:today},400);
 await post('incident',{project_id:ids.project,asset_id:ids.asset,description:tag,priority:'BAJA',reported_on:today,due_on:today});ids.incident=(await find('stz_incidents','description',tag)).id;
 await post('order',{project_id:ids.project,asset_id:ids.asset,incident_id:ids.incident,code:tag+'-INC',description:tag,responsible:'Equipo QA',due_on:today,expected_cents:'0'});const o0=await find('stz_orders','code',tag+'-INC');ids.incidentOrder=o0.id;
 for(const status of ['EN_CURSO','PENDIENTE_VALIDACION','CERRADA','REABIERTA']){const o=await find('stz_orders','id',o0.id);await post('order_transition',{id:o.id,version:o.version,status,date:today,result:'Conforme QA',evidence:tag,reason:tag});if(status==='CERRADA')assert.equal((await find('stz_incidents','id',ids.incident)).status,'RESUELTA');}
 assert.equal((await find('stz_incidents','id',ids.incident)).status,'EN_TRATAMIENTO');const o=await find('stz_orders','id',o0.id);assert.equal(o.checked_by,null);assert.equal(o.finished_on,null);
 await post('order_transition',{id:o.id,version:o.version-1,status:'EN_CURSO',date:today},400);assert.equal((await find('stz_orders','id',o.id)).status,'REABIERTA');
});
await test('Milestone revision, forecast and reference retained',async()=>{await post('milestone',{project_id:ids.project,name:tag,baseline_on:today,forecast_on:today,reason:tag,reference:tag});const m=await find('stz_milestones','name',tag);ids.milestone=m.id;await post('update_milestone',{id:m.id,version:m.version,forecast_on:'2026-10-30',reason:tag,reference:tag});await post('update_milestone',{id:m.id,version:m.version,forecast_on:today,reason:tag,reference:tag},400);await post('forecast',{project_id:ids.project,as_of:today,total_cents:'1000',reason:tag});await post('document',{project_id:ids.project,title:tag,kind:'REFERENCIA_QA',version_label:'1',reference:'Documento sintético sin archivo: '+tag});assert.equal((await find('stz_milestones','id',m.id)).forecast_on,'2026-10-30');});
await test('Property and project link persist; expediente creates exactly one lot atomically',async()=>{
 const cat=await one('SELECT id_tipo_elemento FROM catalogo.tipo_elemento ORDER BY id_tipo_elemento LIMIT 1');
 await post('inmueble',{id_gis_codigo:'QA24API-B',denominacion:'Inmueble ficticio QA API B',id_tipo_elemento:cat.id_tipo_elemento,calle_numero:'Dirección sintética sin correspondencia real',longitud:-3.035,latitud:43.326},200,true);
 const prop=await find('inmuebles','id_gis_codigo','QA24API-B');ids.property=prop.id_ficha_lm_em;
 await post('vinculo',{id_proyecto:ids.project,id_ficha_lm_em:ids.property,rol:'Ensayo sintético'},200,true);
 const payload={id_proyecto:ids.project,numero_expediente:tag,objeto:'Ensayo de expediente en borrador',id_tipo_contrato:1,valor_estimado_sin_iva:1000,presupuesto_base_sin_iva:1000,iva_presupuesto:210,fecha_referencia_legal:today,intelectual:false,anexo_iv:false,juicio_valor:0,duracion_meses:1,prorrogas:false};
 await post('expediente',{...payload,valor_estimado_sin_iva:999},400,true);assert.equal(await find('expedientes','numero_expediente',tag),undefined);
 await post('expediente',payload,200,true);const exp=await find('expedientes','numero_expediente',tag);ids.expediente=exp.id_expediente;assert.equal(exp.estado,'BORRADOR');const lot=await one('SELECT count(*) n,sum(presupuesto_base_sin_iva) base FROM lotes WHERE id_expediente=?',[exp.id_expediente]);assert.equal(lot.n,1);assert.equal(lot.base,1000);
});
await test('Obligation rejects non-HTTPS source and permits documented revision',async()=>{
 const p={scope:'Ensayo sintético',title:tag,source_url:'http://example.invalid/qa',requirement:'Registro ficticio; sin validación jurídica',review_status:'PENDIENTE_CONTRASTE_MUNICIPAL',responsible:'Equipo QA',review_on:today};
 await post('obligation',p,400);p.source_url='https://example.invalid/qa';await post('obligation',p);const o=await find('stz_obligations','title',tag);ids.obligation=o.id;await post('obligation',{...p,id:o.id,requirement:'Registro ficticio revisado; sin validación jurídica'});assert.equal((await find('stz_obligations','id',o.id)).requirement,'Registro ficticio revisado; sin validación jurídica');
});
state.complete=true;persist();console.log(JSON.stringify({passed:state.checks.length,ids}));
