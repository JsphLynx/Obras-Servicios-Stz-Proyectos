import {env} from 'cloudflare:workers';
import {context,checkWrite} from './context';
import {neon,types} from '@neondatabase/serverless';
export type Row=Record<string,any>;
// The UI uses safe integers for identifiers, cents and thousandths; reject overflow.
for(const oid of [20,1700])types.setTypeParser(oid,(value:string)=>{const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)>Number.MAX_SAFE_INTEGER)throw Error('Valor numérico fuera del rango de la aplicación');return n;});
for(const oid of [1082,1114,1184])types.setTypeParser(oid,(value:string)=>value);
const client=()=>{const config=env as unknown as Record<string,string>,mode=context().mode;
 const url=mode==='practice'?config.PRACTICE_DATABASE_URL:config.DATABASE_URL;
 if(!url)throw Error('Conexión del entorno no configurada');
 if(mode==='practice'&&new URL(url).hostname===new URL(config.DATABASE_URL).hostname)throw Error('Las prácticas requieren una conexión independiente');
 return neon(url,{fullResults:true});};
const guard=()=>{const config=env as unknown as Record<string,string>;
 const key=context().mode==='practice'?'STZ_PRACTICE_BRANCH_ID':'STZ_EXAMPLES_BRANCH_ID';
 const expected=config[key];if(!expected)throw Error('Identificador del entorno no configurado');return expected;};
// Translate placeholders only, leaving quoted SQL text untouched. Values never enter SQL text.
export function parameters(sql:string){let n=0;return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g,token=>token==='?'?'$'+(++n):token);}
export class Statement{
 constructor(readonly sql:string,readonly values:any[]=[],readonly checked=false){ }
 bind(...values:any[]){return new Statement(this.sql,values,this.checked);}
 async all<T=Row>(){const q=client();const r=await q.transaction([q.query("SELECT app_stz.check_web_environment($1),set_config('search_path','app_stz,operativa_stz,pg_catalog',true)",[guard()]),q.query(parameters(this.sql),this.values)],{readOnly:true});return {results:r[1].rows as T[]};}
}
export const db=()=>({prepare:(sql:string)=>new Statement(sql),prepareAtomic:(sql:string)=>new Statement(sql,[],true)});
export const all=async(sql:string,v:any[]=[]) => (await db().prepare(sql).bind(...v).all<Row>()).results;
export async function readBatch(sqls:string[]){const q=client();const r=await q.transaction([q.query("SELECT app_stz.check_web_environment($1),set_config('search_path','app_stz,operativa_stz,pg_catalog',true)",[guard()]),...sqls.map(sql=>q.query(parameters(sql)))],{readOnly:true});return r.slice(1).map(x=>x.rows as Row[]);}
export const one=async(sql:string,v:any[]=[]) => (await all(sql,v))[0];
export const insert=(table:string,v:Row)=>db().prepare(`INSERT INTO ${table} (${Object.keys(v).join(',')}) VALUES (${Object.keys(v).map(()=>'?').join(',')})`).bind(...Object.values(v));
export async function mutate(actor:string,reason:string,statements:Statement[]){
 const access=checkWrite();if(actor!==access.userId)throw Error('Actor no válido');
 const q=client();
 const setup=q.query("SELECT app_stz.check_web_environment($3),app_stz.require_ready(),set_config('search_path','app_stz,operativa_stz,pg_catalog',true),set_config('app.actor',$1,true),set_config('app.reason',$2,true)",[actor,reason,guard()]);
 const r=await q.transaction([q.query('SELECT pg_advisory_xact_lock(6284019)'),setup,...statements.map(s=>{
   const text=parameters(s.sql);
   // Stale conditional writes abort the whole transaction, including related incident updates.
   return q.query(s.checked?text:`WITH changed AS (${text} RETURNING 1) SELECT app_stz.require_change(count(*)) affected FROM changed`,s.values);
 })],{isolationLevel:'ReadCommitted'});
 return r.slice(1).map(x=>({results:x.rows,meta:{changes:Number((x.rows[0] as Row)?.affected??x.rowCount)}}));
}
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const stamp=()=>new Date().toISOString();
export function scaled(v:unknown,digits:number){const s=String(v??'').trim().replace(',','.');if(!/^-?\d+(\.\d+)?$/.test(s))throw Error('Número no válido');const [a,b='']=s.replace('-','').split('.');if(b.length>digits)throw Error(`Máximo ${digits} decimales`);const n=(BigInt(a)*10n**BigInt(digits)+BigInt(b.padEnd(digits,'0')))*(s.startsWith('-')?-1n:1n);if(n>100000000000n||n< -100000000000n)throw Error('Importe o cantidad fuera de rango');return Number(n);}
export function moneyProduct(q:number,p:number){return Number((BigInt(q)*BigInt(p)+500n)/1000n);}
