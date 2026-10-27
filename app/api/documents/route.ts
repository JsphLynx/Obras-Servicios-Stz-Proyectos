import {context} from '@/lib/stz/context';
import {authorized} from '@/lib/stz/access';
import {env} from 'cloudflare:workers';
import {one,insert,mutate,stamp} from '@/lib/stz/db';
export const dynamic='force-dynamic';
const json=(error:string,status:number)=>Response.json({error},{status});
async function write(req:Request){
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json('Origen no permitido',403);
 if(!env.BUCKET)return json('Almacenamiento de archivos no disponible',503);
 if(Number(req.headers.get('content-length'))>5300000)return json('Máximo 5 MB',413);
 let key:string|undefined;
 try{
  const form=await req.formData(),file=form.get('file'),project=Number(form.get('project_id')),title=String(form.get('title')||'').trim();
  if(!(file instanceof File)||!file.size||file.size>5*1024*1024)return json('Selecciona un archivo de hasta 5 MB',400);
  if(!Number.isSafeInteger(project)||!await one('SELECT 1 FROM proyectos WHERE id_proyecto=?',[project])||!title||title.length>200)return json('Revisa el proyecto y título',400);
  const mime:Record<string,string>={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',txt:'text/plain'};
  const ext=file.name.split('.').pop()?.toLowerCase()||'';if(!mime[ext])return json('Solo PDF, PNG, JPG o TXT',400);
  const bytes=await file.arrayBuffer(),head=new Uint8Array(bytes);
  if((ext==='pdf'&&new TextDecoder().decode(head.slice(0,5))!=='%PDF-')||(ext==='png'&&head.slice(0,8).join()!=='137,80,78,71,13,10,26,10')||(['jpg','jpeg'].includes(ext)&&(head[0]!==255||head[1]!==216)))return json('El contenido no coincide con el tipo de archivo',400);
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  key=context().mode+'/evidencias/'+crypto.randomUUID()+'.'+ext;
  await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime[ext]}});
  const actor=req.headers.get('oai-authenticated-user-id')!;
  await mutate(actor,'Adjuntar evidencia',[insert('stz_documents',{project_id:project,title,kind:'ARCHIVO',version_label:'1',reference:'Archivo adjunto del piloto',object_key:key,sha256:sha,mime:mime[ext],size_bytes:file.size,actor,created_at:stamp()})]);
  return Response.json({ok:true});
 }catch{if(key)await env.BUCKET.delete(key).catch(()=>{});return json('No se pudo adjuntar el archivo. Revisa los datos e inténtalo de nuevo.',400);}
}
async function read(req:Request){
 const id=Number(new URL(req.url).searchParams.get('id'));if(!Number.isSafeInteger(id)||id<1)return json('Documento no válido',400);
 const doc=await one('SELECT * FROM stz_documents WHERE id=?',[id]);if(!doc)return json('Documento inexistente',404);
 const synthetic=await one('SELECT contenido FROM app_stz.demo_documentos_contenido WHERE document_id=?',[id]);
 if(synthetic)return new Response(synthetic.contenido,{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':`attachment; filename="documento-${id}.txt"`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
 if(!doc.object_key||!env.BUCKET)return json('Documento sin archivo',404);
 if(context().mode==='practice'&&!doc.object_key.startsWith('practice/'))return json('Archivo de otro entorno no disponible en prácticas',404);
 const file=await env.BUCKET.get(doc.object_key);if(!file)return json('Archivo no encontrado',404);
 const ext=doc.object_key.split('.').pop();return new Response(file.body,{headers:{'Content-Type':doc.mime||'application/octet-stream','Content-Disposition':`attachment; filename="documento-${id}.${ext}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
}

export const GET=(req:Request)=>authorized(req,false,()=>read(req));
export const POST=(req:Request)=>authorized(req,true,()=>write(req));
