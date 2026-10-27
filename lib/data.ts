import {db,all,readBatch,mutate} from './stz/db';
import {loadCatalogos,type Catalogos} from './catalog-data';
import {z} from 'zod';
import {tiposEmplazamiento} from './catalogs';
import {orientacion} from './legal';
type Row=Record<string,any>;
const money=z.coerce.number().finite().min(0).max(1e10).refine(n=>Math.abs(n*100-Math.round(n*100))<0.0001,'Utiliza como máximo dos decimales');
const id=z.coerce.number().int().positive();
const optionalId=z.preprocess(v=>v===''||v==null?null:v,id.nullable());
const str=(n=250)=>z.string().trim().min(1,'Completa los campos obligatorios').max(n);
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const date=z.string().refine(validDate,'Fecha no válida');
const optionalDate=z.preprocess(v=>v===''||v==null?null:v,date.nullable());
const insert=(table:string,v:Row)=>db().prepare(`INSERT INTO ${table} (${Object.keys(v).join(',')}) VALUES (${Object.keys(v).map(()=>'?').join(',')})`).bind(...Object.values(v));
const projectSql=`SELECT p.*,round(coalesce((SELECT sum(g.importe) FROM gastos g WHERE g.id_proyecto=p.id_proyecto),0)+coalesce((SELECT sum(il.base_cents+il.vat_cents)/100.0 FROM stz_invoice_lines il JOIN stz_invoices f ON f.id=il.invoice_id WHERE f.project_id=p.id_proyecto AND f.status='REGISTRADA'),0),2) gastos_imputados,(SELECT count(*) FROM expedientes e WHERE e.id_proyecto=p.id_proyecto) numero_expedientes,(SELECT count(*) FROM proyecto_emplazamientos pe WHERE pe.id_proyecto=p.id_proyecto) numero_emplazamientos FROM proyectos p`;
function projectDecorate(p:Row,catalogos:Catalogos){return {...p,estado_codigo:catalogos.estados.find(r=>r.id_estado_proyecto===p.id_estado_proyecto)?.codigo,estado:catalogos.estados.find(r=>r.id_estado_proyecto===p.id_estado_proyecto)?.nombre,updated_at:p.version,clasificacion:p.regimen_ejecucion==='MEDIOS_PROPIOS'?'ADMINISTRACION_DIRECTA':'REVISION_POR_EXPEDIENTE',saldo_planificacion:Math.round((p.presupuesto_proyecto-p.gastos_imputados)*100)/100};}
export async function data(){
 const catalogos=await loadCatalogos();
 const [p,inmuebles,vinculos,emplazamientos,ambitos,a,e,g,repartos]=await readBatch([
 (projectSql+' ORDER BY p.codigo_proyecto'),('SELECT * FROM inmuebles'),('SELECT * FROM proyecto_inmuebles'),('SELECT * FROM emplazamientos'),('SELECT * FROM proyecto_emplazamientos'),
 (`SELECT a.*,p.codigo_proyecto,l.nombre emplazamiento,coalesce((SELECT round(sum(r.importe_imputado),2) FROM actuacion_gastos r WHERE r.id_actuacion=a.id_actuacion),0) coste_repartido FROM actuaciones a JOIN proyectos p USING(id_proyecto) LEFT JOIN emplazamientos l USING(id_emplazamiento)`),
 (`SELECT e.*,p.codigo_proyecto,(SELECT count(*) FROM lotes l WHERE l.id_expediente=e.id_expediente) lotes FROM expedientes e JOIN proyectos p USING(id_proyecto)`),
 (`SELECT g.*,p.codigo_proyecto,g.importe importe_imputado,coalesce((SELECT round(sum(r.importe_imputado),2) FROM actuacion_gastos r WHERE r.id_gasto=g.id_gasto),0) repartido FROM gastos g JOIN proyectos p USING(id_proyecto)`),
 (`SELECT r.*,a.descripcion actuacion,g.numero_factura,p.codigo_proyecto FROM actuacion_gastos r JOIN actuaciones a USING(id_actuacion) JOIN gastos g ON g.id_gasto=r.id_gasto JOIN proyectos p ON p.id_proyecto=r.id_proyecto`)]);
 return {proyectos:p.map(p=>projectDecorate(p,catalogos)),inmuebles,vinculos,emplazamientos,ambitos,actuaciones:a.map(r=>({...r,estado_codigo:catalogos.estadosActuacion.find(c=>c.id_estado_actuacion===r.id_estado_actuacion)?.codigo})),expedientes:e.map(r=>({...r,tipo:catalogos.tiposContrato.find(c=>c.id_tipo_contrato===r.id_tipo_contrato)?.nombre,...orientacion(r)})),gastos:g.map(r=>({...r,pendiente_reparto:Math.round((r.importe-r.repartido)*100)/100})),repartos,catalogos,fecha:new Date().toISOString()};
}
export async function save(kind:string,raw:Row,actor="servicio-autorizado-del-piloto"){
 const catalogos=await loadCatalogos();const catId=(name:string)=>id.refine(v=>catalogos[name].some(r=>r['id_'+({origenes:'origen_proyecto',estados:'estado_proyecto',departamentos:'departamento',tiposActuacion:'tipo_actuacion',estadosActuacion:'estado_actuacion',tiposElemento:'tipo_elemento',tiposContrato:'tipo_contrato',tiposGasto:'tipo_gasto'} as Record<string,string>)[name]]===v),'Opción de catálogo no válida');let table='',v:Row={};
 if(kind==='proyecto'){
 table='proyectos';v=z.object({codigo_proyecto:str(40),nombre:str(),descripcion:z.string().trim().max(4000).default(''),id_origen_proyecto:catId('origenes'),id_estado_proyecto:catId('estados'),id_departamento_responsable:catId('departamentos'),regimen_ejecucion:z.enum(['PENDIENTE','CONTRATACION','MEDIOS_PROPIOS','MIXTO']),presupuesto_proyecto:money,responsable:str(180),fecha_inicio_prevista:optionalDate,fecha_fin_prevista:optionalDate}).parse(raw);
 if(v.fecha_inicio_prevista&&v.fecha_fin_prevista&&v.fecha_fin_prevista<v.fecha_inicio_prevista)throw Error('El fin no puede ser anterior al inicio');
 }else if(kind==='inmueble'){
 table='inmuebles';v=z.object({id_gis_codigo:str(20),denominacion:str(150),id_tipo_elemento:catId('tiposElemento'),calle_numero:str(200),longitud:z.coerce.number().min(-180).max(180),latitud:z.coerce.number().min(-90).max(90)}).parse(raw);
 }else if(kind==='vinculo'){
 table='proyecto_inmuebles';v=z.object({id_proyecto:id,id_ficha_lm_em:id,rol:str(100)}).parse(raw);
 }else if(kind==='emplazamiento'){
 table='gis.emplazamientos';v=z.object({codigo:str(40),nombre:str(),tipo:z.string().refine(t=>tiposEmplazamiento.includes(t)),id_ficha_lm_em:optionalId,descripcion:z.string().max(4000).default(''),direccion:str(200)}).parse(raw);v.id_tipo_emplazamiento=(await all('SELECT id_tipo_emplazamiento FROM catalogo.tipo_emplazamiento WHERE codigo=?',[v.tipo]))[0]?.id_tipo_emplazamiento;delete v.tipo;
 }else if(kind==='ambito'){
 table='proyecto_emplazamientos';v=z.object({id_proyecto:id,id_emplazamiento:id,rol:str(100)}).parse(raw);
 }else if(kind==='actuacion'){
 table='actuaciones';v=z.object({id_proyecto:id,id_ficha_lm_em:optionalId,id_emplazamiento:optionalId,id_tipo_actuacion:catId('tiposActuacion'),id_estado_actuacion:catId('estadosActuacion'),descripcion:str(4000),responsable:str(180),fecha_fin_prevista:optionalDate,porcentaje_avance:z.coerce.number().min(0).max(100),presupuesto_previsto:money}).parse(raw);
 if(catalogos.estadosActuacion.find(c=>c.id_estado_actuacion===v.id_estado_actuacion)?.codigo==='FINALIZADO'&&v.porcentaje_avance!==100)throw Error('Una actuación finalizada debe tener un avance del 100%');
 }else if(kind==='expediente'){
 table='contratacion.expedientes';const parsed=z.object({id_proyecto:id,numero_expediente:str(100),objeto:str(4000),id_tipo_contrato:catId('tiposContrato'),valor_estimado_sin_iva:money,presupuesto_base_sin_iva:money,iva_presupuesto:money,fecha_referencia_legal:date,intelectual:z.boolean(),anexo_iv:z.boolean(),juicio_valor:z.coerce.number().min(0).max(100),duracion_meses:z.coerce.number().int().positive().max(1200),prorrogas:z.boolean()}).parse(raw);const {intelectual,anexo_iv,prorrogas,juicio_valor,...rest}=parsed;v={...rest,prestacion_intelectual:intelectual,servicios_anexo_iv:anexo_iv,preve_prorroga:prorrogas,porcentaje_juicio_valor:juicio_valor,estado:'BORRADOR'};
 if(v.valor_estimado_sin_iva<v.presupuesto_base_sin_iva)throw Error('El VEC debe incluir al menos el presupuesto base sin IVA');
 await mutate(actor,'Alta de expediente',[insert(table,v),db().prepare(`INSERT INTO contratacion.lotes(id_expediente,numero_lote,objeto,valor_estimado_sin_iva,presupuesto_base_sin_iva,iva_presupuesto,estado) SELECT id_expediente,0,objeto,valor_estimado_sin_iva,presupuesto_base_sin_iva,iva_presupuesto,'BORRADOR' FROM contratacion.expedientes WHERE numero_expediente=?`).bind(v.numero_expediente)]);return {ok:true};
 }else if(kind==='gasto'){
 table='gastos';const parsed=z.object({id_proyecto:id,id_tipo_gasto:catId('tiposGasto'),numero_factura:str(100),concepto:str(),proveedor:str(200),importe:money.refine(x=>x>0,'El importe debe ser positivo'),fecha_gasto:date,pagado:z.boolean(),fecha_pago:optionalDate}).parse(raw);v={...parsed,pagado:parsed.pagado,fecha_pago:parsed.pagado?parsed.fecha_pago:null};
 if(v.pagado&&(!v.fecha_pago||v.fecha_pago<v.fecha_gasto))throw Error('Indica una fecha de pago igual o posterior al gasto');
 }else if(kind==='reparto'){
 table='actuacion_gastos';v=z.object({id_proyecto:id,id_actuacion:id,id_gasto:id,importe_imputado:money.refine(x=>x>0,'El reparto debe ser positivo'),criterio_reparto:str(500)}).parse(raw);
 }else throw Error('Formulario no reconocido');
 if(kind==='gasto'){
 const {id_proyecto,...expense}=v;const keys=Object.keys(expense);
 await mutate(actor,'Alta de gasto e imputación al proyecto',[db().prepareAtomic(`WITH nuevo AS (INSERT INTO economico.gastos_ficha (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')}) RETURNING id_gasto,importe), changed AS (INSERT INTO gestion.proyecto_gastos(id_proyecto,id_gasto,importe_imputado,criterio_reparto) SELECT ?,id_gasto,importe,'Imputación al proyecto desde Obras y Servicios' FROM nuevo RETURNING 1) SELECT app_stz.require_change(count(*)) affected FROM changed`).bind(...Object.values(expense),id_proyecto)]);return {ok:true};
 }
 if(raw.id&&kind==='reparto'){
 const result=(await mutate(actor,'Edición de reparto',[db().prepare('UPDATE actuacion_gastos SET importe_imputado=?,criterio_reparto=? WHERE id_actuacion_gasto=? AND id_proyecto=? AND id_gasto=? AND id_actuacion=? AND importe_imputado=? AND criterio_reparto=?').bind(v.importe_imputado,v.criterio_reparto,id.parse(raw.id),v.id_proyecto,v.id_gasto,v.id_actuacion,money.parse(raw.importe_anterior),str(500).parse(raw.criterio_anterior))]))[1];
 if(!result.meta.changes)throw Error('El reparto cambió en otra sesión. Actualiza y vuelve a editar.');return {ok:true};
 }
 if(raw.id&&(kind==='proyecto'||kind==='actuacion')){
 const key=kind==='proyecto'?'id_proyecto':'id_actuacion';
 const res=(await mutate(actor,'Edición de '+kind,[db().prepare(`UPDATE ${table} SET ${Object.keys(v).map(k=>`${k}=?`).join(',')},version=version+1 WHERE ${key}=? AND version=?`).bind(...Object.values(v),id.parse(raw.id),id.parse(raw.version))]))[1];
 if(!res.meta.changes)throw Error('El registro cambió en otra sesión. Cierra el formulario, actualiza y vuelve a editar.');
 }else await mutate(actor,'Alta de '+kind,[insert(table,v)]);
 return {ok:true};
}
export async function query(raw:unknown){
 const catalogos=await loadCatalogos();const f=z.object({texto:z.string().max(150).default(''),estado:z.string().default(''),minimo:money.default(0),vencidas:z.boolean().default(false),orden:z.enum(['codigo','gasto','presupuesto']).default('codigo'),tipo:z.string().default(''),multizona:z.boolean().default(false)}).parse(raw);
 const where:string[]=['1=1'],params:any[]=[];
 if(f.texto){where.push('(p.nombre ILIKE ? ESCAPE \'\\\' OR p.codigo_proyecto ILIKE ? ESCAPE \'\\\')');const escaped=f.texto.replace(/[\\%_]/g,'\\$&');params.push('%'+escaped+'%','%'+escaped+'%');}
 if(f.estado){where.push('p.id_estado_proyecto=?');params.push(catalogos.estados.find(r=>r.codigo===f.estado)?.id_estado_proyecto||-1);}
 where.push("(coalesce((SELECT sum(g.importe) FROM gastos g WHERE g.id_proyecto=p.id_proyecto),0)+coalesce((SELECT sum(il.base_cents+il.vat_cents)/100.0 FROM stz_invoice_lines il JOIN stz_invoices f ON f.id=il.invoice_id WHERE f.project_id=p.id_proyecto AND f.status='REGISTRADA'),0))>=?");params.push(f.minimo);
 if(f.tipo){where.push('EXISTS(SELECT 1 FROM proyecto_emplazamientos pe JOIN emplazamientos l USING(id_emplazamiento) WHERE pe.id_proyecto=p.id_proyecto AND l.tipo=?)');params.push(f.tipo);}
 if(f.multizona)where.push('(SELECT count(*) FROM proyecto_emplazamientos pe WHERE pe.id_proyecto=p.id_proyecto)>1');
 if(f.vencidas){where.push("EXISTS(SELECT 1 FROM actuaciones a WHERE a.id_proyecto=p.id_proyecto AND a.fecha_fin_prevista<? AND a.id_estado_actuacion NOT IN (SELECT id_estado_actuacion FROM catalogo.estado_actuacion WHERE codigo IN ('FINALIZADO','ANULADO')))");params.push(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));}
 const sql=projectSql+' WHERE '+where.join(' AND ')+' ORDER BY '+({codigo:'p.codigo_proyecto',gasto:'gastos_imputados DESC',presupuesto:'p.presupuesto_proyecto DESC'}[f.orden])+' LIMIT 500';
 return {rows:(await all(sql,params)).map(p=>projectDecorate(p,catalogos)),sql,params};
}
