import {env} from 'cloudflare:workers';
import {neon} from '@neondatabase/serverless';
import {AccessError,requestContext,type Access,type Role} from './context';
export const settings=()=>env as unknown as Record<string,string>;
export function identity(req:Request){const userId=req.headers.get('oai-authenticated-user-id'),email=req.headers.get('oai-authenticated-user-email');if(!userId||!email)throw new AccessError('Inicia sesión con ChatGPT para acceder.',401);return {userId,email:email.trim().toLowerCase()};}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)throw new AccessError('Origen no permitido',403);}
export const authClient=()=>{const url=settings().AUTH_DATABASE_URL||settings().DATABASE_URL;if(!url)throw new AccessError('Conexión de usuarios no configurada',503);return neon(url);};
export async function resolveAccess(req:Request,register=false):Promise<Access>{
 const user=identity(req),q=authClient();
 if(register){
  // Serialize first-owner binding. Only the platform-verified owner email can bootstrap.
  await q.transaction([
   q.query('SELECT pg_advisory_xact_lock(6284020)'),
   q.query(`INSERT INTO app_stz.web_users(user_id,email,role) VALUES($1,$2,CASE WHEN $2=$3 AND $3<>'' AND NOT EXISTS(SELECT 1 FROM app_stz.web_users WHERE role='ADMIN') THEN 'ADMIN' ELSE 'PENDIENTE' END) ON CONFLICT(user_id) DO NOTHING`,[user.userId,user.email,(settings().STZ_OWNER_EMAIL||'').trim().toLowerCase()])
  ]);
 }
 const rows=await q.query('SELECT role FROM app_stz.web_users WHERE user_id=$1',[user.userId]);
 const role=(rows[0]?.role||'PENDIENTE') as Role;
 const selected=req.headers.get('x-stz-environment')||new URL(req.url).searchParams.get('environment')||'examples';
 if(!['examples','practice'].includes(selected))throw new AccessError('Entorno no válido',400);
 if(!register&&['PENDIENTE','BLOQUEADO'].includes(role))throw new AccessError('Acceso pendiente de autorización del administrador.',403);
 return {...user,role,mode:selected as Access['mode'],canWrite:selected==='practice'&&['ADMIN','EDITOR'].includes(role)};
}
export function failure(e:unknown){const status=e instanceof AccessError?e.status:503;return Response.json({error:e instanceof AccessError?e.message:'No se pudo completar la operación. Actualiza y vuelve a intentarlo.'},{status,headers:{'Cache-Control':'no-store'}});}
export async function authorized(req:Request,write:boolean,action:(a:Access)=>Promise<Response>){try{if(write)sameOrigin(req);const a=await resolveAccess(req);if(write&&!a.canWrite)throw new AccessError('Los ejemplos son de consulta. Para guardar necesitas Prácticas y permiso de edición.',403);return await requestContext.run(a,()=>action(a));}catch(e){return failure(e);}}
