// Hidden stdin keeps connection strings out of command arguments and logs.
import fs from 'node:fs';
process.stdin.setRawMode?.(true);
process.stdout.write('Ready for runtime JSON (hidden input).\n');
let input='';
for await(const chunk of process.stdin){input+=chunk.toString();if(input.includes('\n'))break;}
process.stdin.setRawMode?.(false);
const config=JSON.parse(input.trim());
if(config.action==='env'){
 fs.writeFileSync('.env.local',Object.entries(config.env).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{mode:0o600});
 console.log('Local runtime configured; values hidden.');
}else{
 globalThis.TEST_ENV=config.env;
 await import('../tests/integral.test.mjs');
}
