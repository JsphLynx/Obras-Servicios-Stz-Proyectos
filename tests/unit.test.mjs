// Offline tests: no database, network, real identity or bucket is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
function fixture(){
 const env={DATABASE_URL:'postgresql://stz_runtime:unused@examples.invalid/db',PRACTICE_DATABASE_URL:'postgresql://stz_runtime:unused@practice.invalid/db',STZ_EXAMPLES_BRANCH_ID:'examples-test',STZ_PRACTICE_BRANCH_ID:'practice-test'};
 const calls=[],cache=new Map();
 const neon=url=>{calls.push({url});return {query:(text,values)=>({text,values}),transaction:async(queries,options)=>{calls.push({queries,options});return queries.map(()=>({rows:[]}));}};};
 function load(name){
  const file=path.resolve(name);if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const req=x=>x==='cloudflare:workers'?{env}:x==='@neondatabase/serverless'?{neon,types:{setTypeParser(){}}}:x.startsWith('.')?load(path.resolve(path.dirname(file),x+'.ts')):require(x);
  vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{URL,Intl,Date,Error,console})(req,module,module.exports);return module.exports;
 }
 return {env,calls,db:load('lib/stz/db.ts'),ctx:load('lib/stz/context.ts')};
}
const access=(mode='practice',canWrite=true)=>({userId:'offline-test',email:'test@example.invalid',role:canWrite?'EDITOR':'LECTOR',mode,canWrite});
test('Currency and quantities preserve decimal precision',()=>{const {db}=fixture();assert.equal(db.scaled('96,80',2),9680);assert.equal(db.scaled('-12.10',2),-1210);assert.equal(db.scaled('0.001',3),1);assert.equal(db.moneyProduct(1500,199),299);});
test('Malformed values, excess precision and overflow are rejected',()=>{const {db}=fixture();for(const value of ['','1e3','1.001','NaN','1000000000.01'])assert.throws(()=>db.scaled(value,2));});
test('SQL placeholders skip quoted values and identifiers',()=>{const {db}=fixture();assert.equal(db.parameters(`SELECT '?', "?", 'it''s ?', ? WHERE id=?`),`SELECT '?', "?", 'it''s ?', $1 WHERE id=$2`);});
test('Missing request context is unauthorized',()=>{const {ctx}=fixture();assert.throws(()=>ctx.context(),e=>e.status===401);});
test('Readers and even writable contexts in examples cannot mutate',()=>{const {ctx}=fixture();for(const value of [access('practice',false),access('examples',true)])ctx.requestContext.run(value,()=>assert.throws(()=>ctx.checkWrite(),e=>e.status===403));ctx.requestContext.run(access(),()=>assert.equal(ctx.checkWrite().userId,'offline-test'));});
test('Each environment uses its configured connection and guard',async()=>{for(const mode of ['examples','practice']){const {ctx,db,calls}=fixture();await ctx.requestContext.run(access(mode),()=>db.all('SELECT ?', [1]));assert.equal(new URL(calls[0].url).hostname,mode+'.invalid');assert.equal(calls[1].queries[0].values[0],mode+'-test');assert.equal(calls[1].options.readOnly,true);assert.equal(calls[1].queries[1].text,'SELECT $1');}});
test('Missing environment identifier fails closed before a transaction',async()=>{const {ctx,db,env,calls}=fixture();env.STZ_PRACTICE_BRANCH_ID='';await assert.rejects(ctx.requestContext.run(access(),()=>db.all('SELECT 1')),/Identificador/);assert.equal(calls.filter(x=>x.queries).length,0);});
test('Shared example and practice endpoint is rejected',async()=>{const {ctx,db,env,calls}=fixture();env.PRACTICE_DATABASE_URL=env.DATABASE_URL;await assert.rejects(ctx.requestContext.run(access(),()=>db.all('SELECT 1')),/independiente/);assert.equal(calls.length,0);});
test('An inconsistent audit actor cannot start a mutation',async()=>{const {ctx,db,calls}=fixture();await assert.rejects(ctx.requestContext.run(access(),()=>db.mutate('someone-else','test',[])),/Actor/);assert.equal(calls.length,0);});
