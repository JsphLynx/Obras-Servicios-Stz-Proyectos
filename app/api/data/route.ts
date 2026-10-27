import {authorized} from '@/lib/stz/access';
import { data,save,query } from '@/lib/data';
import { ZodError } from 'zod';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
// Sites restringe toda esta aplicación al propietario, incluido /api.
// No cambiar la audiencia sin añadir autorización por usuario.
async function read(req:Request){try{return json(await data());}catch{return json({error:'No se ha podido leer la base de datos. Prueba Actualizar.'},503);}}
async function write(req:Request){
 const origin=req.headers.get('origin');
 if(origin && origin!==new URL(req.url).origin)return json({error:'Origen no permitido'},403);
 if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'Formato no válido'},415);
 try{const raw=await req.text();if(raw.length>20000)return json({error:'Formulario demasiado grande'},413);const b=JSON.parse(raw);return json(b.kind==='consulta'?await query(b.data):await save(b.kind,b.data,req.headers.get('oai-authenticated-user-id')!));}
 catch(e){if(e instanceof ZodError)return json({error:e.issues[0]?.message||'Revisa los campos'},400);const message=(e as Error).message||'Solicitud no válida';let error=message;
 if(/unique constraint/i.test(message))error='Ya existe ese código o vínculo. Selecciona otro.';
 else if(/FOREIGN KEY/i.test(message))error='Relación no válida: comprueba que inmueble, emplazamiento, actuación y gasto pertenecen al proyecto.';
 else if(/supera el importe/i.test(message))error='El reparto supera el importe disponible del gasto.';
 else if(/Vincula primero/i.test(message))error='Vincula primero el inmueble del emplazamiento al proyecto.';
 else if(/deben coincidir/i.test(message))error='El inmueble y el emplazamiento de la actuación deben coincidir.';
 else if(/constraint|syntax error|does not exist|permission denied/i.test(message))error='No se pudo guardar. Revisa los datos y sus relaciones.';
 return json({error},400);}
}

export const GET=(req:Request)=>authorized(req,false,()=>read(req));
export async function POST(req:Request){let kind;try{kind=(await req.clone().json() as {kind?:string}).kind;}catch{return Response.json({error:'JSON no válido'},{status:400});}return authorized(req,kind!=='consulta',()=>write(req));}
