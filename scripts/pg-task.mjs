// Administrative runner: credentials only through hidden stdin, never stored or logged.
import fs from 'node:fs';
import {neon,types} from '@neondatabase/serverless';
for(const oid of [20,1700])types.setTypeParser(oid,Number);
for(const oid of [1082,1114,1184])types.setTypeParser(oid,x=>x);
if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');process.stdout.write('Ready for database task JSON on stdin (input is hidden).\n');
let input='';for await(const chunk of process.stdin){input+=chunk;if(input.includes('\n'))break;}if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();
const args=JSON.parse(input.trim()),sql=neon(args.connection,{fullResults:true});
function split(s){let start=0,out=[];const re=/'(?:''|[^'])*'|\$([A-Za-z_][\w]*)?\$[\s\S]*?\$\1\$|--[^\n]*|;/g;let m;while((m=re.exec(s)))if(m[0]===';'){out.push(s.slice(start,m.index));start=re.lastIndex;}if(s.slice(start).trim())out.push(s.slice(start));return out.filter(x=>x.replace(/--[^\n]*/g,'').trim());}
try{
 if(args.files){const queries=args.files.flatMap(f=>split(fs.readFileSync(f,'utf8')));const r=await sql.transaction(queries.map(s=>sql.query(s)),{isolationLevel:'ReadCommitted'});console.log(JSON.stringify({ok:true,statements:r.length}));}
 else if(args.sql){const r=await sql.query(args.sql,args.params||[]);console.log(JSON.stringify(r.rows));}
 else if(args.reconcile){globalThis.PG_RECONCILE={connection:args.connection,snapshot:args.reconcile};await import('./reconcile-mvp.mjs');}
 else if(args.test){globalThis.PG_TEST_CONNECTION=args.connection;globalThis.PG_TEST_SKIP=args.skip||0;await import('../tests/postgres.test.mjs');}
}catch(e){console.error(JSON.stringify({error:e.message,code:e.code,detail:e.detail,where:e.where}));process.exitCode=1;}

process.exit(process.exitCode||0);
