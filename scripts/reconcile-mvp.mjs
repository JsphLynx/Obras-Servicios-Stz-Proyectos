import fs from 'node:fs';import assert from 'node:assert/strict';import {neon} from '@neondatabase/serverless';
const a=globalThis.PG_RECONCILE,sql=neon(a.connection);
const old=JSON.parse(fs.readFileSync(a.snapshot,'utf8'));
const exclude=new Set(['demo_metadata','stz_audit_context']);const tables=Object.keys(old).filter(t=>!exclude.has(t));
const rows=await sql.query(tables.map(t=>`SELECT '${t}' t,to_jsonb(r) r FROM ${t.startsWith('stz_')?'operativa_stz':'app_stz'}.${t} r`).join(' UNION ALL '));
const cats={origen_proyecto:['PLAN_MUNICIPAL','DEMANDA_CIUDADANA','CONSERVACION'],estado_proyecto:['PLANIFICADO','EN_EJECUCION','FINALIZADO','ANULADO'],departamento:['OBRAS_Y_SERVICIOS','MEDIO_AMBIENTE','DEPORTES'],tipo_actuacion:['OBRA','SUMINISTRO','SERVICIO','ESTUDIO','MANTENIMIENTO'],estado_actuacion:['PLANIFICADO','EN_EJECUCION','FINALIZADO','ANULADO'],tipo_elemento:['EDIFICIO','INSTALACION'],tipo_contrato:['OBRAS','SUMINISTROS','SERVICIOS','CONCESION_SERVICIOS','CONCESION_OBRAS','MIXTO'],tipo_gasto:['CERTIFICACION','SUMINISTRO','SERVICIO','COSTE_INTERNO']};
const catRows=await sql.query(Object.keys(cats).map(t=>`SELECT '${t}' t,id_${t} id,codigo FROM catalogo.${t}`).join(' UNION ALL '));
const stable=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
function norm(r,keys,original,table){return JSON.stringify(stable(Object.fromEntries(keys.map(k=>{
 let v=r[k];const c=k==='id_departamento_responsable'?'departamento':k.slice(3);
 if(!table.startsWith('stz_')&&k.startsWith('id_')&&cats[c]&&v!=null)v=original?cats[c][v-1]:catRows.find(x=>x.t===c&&Number(x.id)===v)?.codigo;
 if(['pagado','intelectual','anexo_iv','prorrogas'].includes(k))v=Boolean(v);
 if(['before_json','after_json'].includes(k)&&typeof v==='string')v=JSON.parse(v);
 if(k==='created_at'&&v)v=new Date(v).toISOString();
 return [k,v];
}))));}
let count=0;for(const t of tables){const current=rows.filter(x=>x.t===t).map(x=>x.r),keys=Object.keys(old[t][0]||{});assert.equal(current.length,old[t].length,`${t}: row count`);assert.deepEqual(current.map(r=>norm(r,keys,false,t)).sort(),old[t].map(r=>norm(r,keys,true,t)).sort(),`${t}: values differ`);count+=current.length;}
console.log(JSON.stringify({reconciled:true,tables:tables.length,records:count,metadataExcluded:[...exclude]}));
