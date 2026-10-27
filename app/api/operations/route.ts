import {authorized} from '@/lib/stz/access';
import {data} from '@/lib/data';
import {overview,command} from '@/lib/stz/service';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function read(req:Request){try{const base=await data();return json({...await overview(),projects:base.proyectos,actions:base.actuaciones,locations:base.emplazamientos,legacyExpenses:base.gastos});}catch(e){console.error('operations read failed',e instanceof Error?e.message:'error');return json({error:'No se pudo leer el piloto. Actualiza para reintentar.'},503);}}
async function write(req:Request){
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'Origen no permitido'},403);
 try{if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'Formato no válido'},415);const text=await req.text();if(text.length>40000)return json({error:'Formulario demasiado grande'},413);const body=JSON.parse(text);if(!body.data||typeof body.data!=='object')throw Error('Formulario no válido');return json(await command(body.kind,body.data,req.headers.get('oai-authenticated-user-id')!));}
 catch(e){let error=(e as Error).message||'No se pudo guardar';if(/unique constraint/i.test(error))error='Ya existe ese registro o vínculo. Actualiza antes de repetir.';else if(/FOREIGN KEY/i.test(error))error='Relación no válida: revisa proyecto, contrato y registro asociado.';else if(/D1_ERROR:/.test(error))error=error.replace(/^.*D1_ERROR:\s*/,'').replace(/: SQLITE_CONSTRAINT.*$/,'');if(/syntax error|does not exist|check constraint/i.test(error))error='Los datos incumplen una regla de integridad.';return json({error},400);}
}

export const GET=(req:Request)=>authorized(req,false,()=>read(req));
export const POST=(req:Request)=>authorized(req,true,()=>write(req));
