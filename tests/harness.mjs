import * as Neon from '@neondatabase/serverless';
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript'),root=process.cwd();
const env=globalThis.TEST_ENV;if(!env?.AUTH_DATABASE_URL)throw Error('Provide isolated QA configuration via hidden stdin');
// Explicit allowlist: provision isolated QA targets before running integration tests.
const targets={DATABASE_URL:env.QA_EXAMPLES_HOST,PRACTICE_DATABASE_URL:env.QA_PRACTICE_HOST,AUTH_DATABASE_URL:env.QA_AUTH_HOST};
assert.ok(Object.values(targets).every(Boolean),'Configure every QA host explicitly');
assert.equal(new Set(Object.values(targets)).size,3,'Use three distinct QA endpoints');
assert.ok(env.STZ_EXAMPLES_BRANCH_ID&&env.STZ_PRACTICE_BRANCH_ID,'Configure environment guard identifiers');
for(const [key,host] of Object.entries(targets)){const u=new URL(env[key]);assert.equal(u.hostname,host,'Unexpected target '+key);assert.equal(decodeURIComponent(u.username),'stz_runtime');}
console.log('QA allowlist verified; business writes use practice and QA identities use a separate database');
const bucketFiles=new Map(),bucket={put:async(k,b)=>bucketFiles.set(k,b),delete:async k=>bucketFiles.delete(k),get:async k=>bucketFiles.has(k)?{body:bucketFiles.get(k)}:null};
const workerEnv={...env,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const m={exports:{}};cache[file]=m;const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;const req=x=>x==='@neondatabase/serverless'?Neon:x==='cloudflare:workers'?{env:workerEnv}:x.startsWith('@/')?load(path.join(root,x.slice(2)+'.ts')):x.startsWith('.')?load(path.resolve(path.dirname(file),x+'.ts')):require(x);vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{console,Intl,Date,Error,URL,File,Request,Response,crypto,Uint8Array,TextDecoder})(req,m,m.exports);return m.exports;}
const data=load('app/api/data/route.ts'),operations=load('app/api/operations/route.ts'),documents=load('app/api/documents/route.ts'),users=load('app/api/users/route.ts'),session=load('app/api/session/route.ts');
function req(route,method='GET',payload,role='editor',mode='practice'){const headers={'x-stz-environment':mode,'origin':'https://pilot.test'};if(role){headers['oai-authenticated-user-id']='qa-'+role;headers['oai-authenticated-user-email']=role+'@example.invalid';}if(payload)headers['content-type']='application/json';return new Request('https://pilot.test/api/'+route,{method,headers,...(payload?{body:JSON.stringify(payload)}:{})});}
export {load,req,env,workerEnv,bucketFiles,data,operations,documents,users,session};
