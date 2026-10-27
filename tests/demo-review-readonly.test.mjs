// Read-only verification of the reviewed manuals and synthetic document bytes.
// Uses isolated QA identities through the existing harness; never writes business data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {operations,documents,req} from './harness.mjs';
const response=await operations.GET(req('operations','GET',undefined,'admin','examples'));
assert.equal(response.status,200);
const bundle=await response.json();
assert.equal(bundle.manuals.length,10);
for(const manual of bundle.manuals){
 assert.equal(manual.version,'1.0-manuales-20261023');
 assert.match(manual.manual_md,/Cómo abrirlo/);
 assert.match(manual.manual_md,/prácticas/i);
 assert.ok(!manual.manual_md.includes('no forman parte de esta carga'));
}
console.log('10 reviewed manuals returned by the application route.');
const queue=bundle.documents.filter(d=>d.has_content),results=[];
async function worker(){
 while(queue.length){
  const d=queue.shift();
  const request=new Request('https://pilot.test/api/documents?id='+d.id,{headers:{'x-stz-environment':'examples','oai-authenticated-user-id':'qa-admin','oai-authenticated-user-email':'admin@example.invalid'}});
  const r=await documents.GET(request);
  assert.equal(r.status,200,'Document '+d.id);
  const bytes=await r.arrayBuffer();
  assert.equal(Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex'),d.sha256);
  assert.equal(bytes.byteLength,d.size_bytes);
  results.push({id:d.id,bytes:bytes.byteLength,sha256_matches:true});
  console.log('Verified document '+d.id+' ('+results.length+'/40)');
 }
}
await Promise.all(Array.from({length:4},worker));
assert.equal(results.length,40);
const result={date:'2026-10-23',type:'read-only application routes with QA identity',manuals:10,version:'1.0-manuales-20261023',document_downloads:40,download_hashes_match:true,real_browser:false,documents:results.sort((a,b)=>a.id-b.id)};
fs.writeFileSync('docs/validation/demo-route-review-20261023.json',JSON.stringify(result,null,2)+'\n');
console.log('Read-only route verification complete.');
