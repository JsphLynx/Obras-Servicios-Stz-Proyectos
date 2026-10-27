import {resolveAccess,failure} from '@/lib/stz/access';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return Response.json(await resolveAccess(req,true),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
