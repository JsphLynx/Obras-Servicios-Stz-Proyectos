import {resolveAccess,authClient,sameOrigin,failure} from '@/lib/stz/access';
import {AccessError} from '@/lib/stz/context';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const a=await resolveAccess(req);if(a.role!=='ADMIN')throw new AccessError('Solo el administrador gestiona usuarios',403);return Response.json(await authClient().query('SELECT user_id,email,role,created_at FROM app_stz.web_users ORDER BY created_at'),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 sameOrigin(req);const a=await resolveAccess(req);if(a.role!=='ADMIN')throw new AccessError('Solo el administrador gestiona usuarios',403);
 const b=await req.json() as Record<string,string>;
 if(!b.userId||!['EDITOR','LECTOR','BLOQUEADO'].includes(b.role))throw new AccessError('Usuario o perfil no válido',400);
 if(b.userId===a.userId)throw new AccessError('No puedes retirar tu propio acceso de administrador',400);
 const q=authClient();const r=await q.transaction([q.query('SELECT pg_advisory_xact_lock(6284020)'),q.query(`WITH previous AS (SELECT user_id,role FROM app_stz.web_users WHERE user_id=$1 AND role<>'ADMIN' FOR UPDATE), changed AS (UPDATE app_stz.web_users u SET role=$2,updated_at=now() FROM previous p WHERE u.user_id=p.user_id RETURNING p.role old_role,u.user_id) INSERT INTO app_stz.web_access_audit(actor,subject,old_role,new_role) SELECT $3,user_id,old_role,$2 FROM changed RETURNING id`,[b.userId,b.role,a.userId])]);
 if(!r[1].length)throw new AccessError('Usuario no disponible para este cambio',400);
 return Response.json({ok:true});
 }catch(e){return failure(e);}}
