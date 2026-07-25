/* node --check equivalent for the inline engine (QUERY-SPEC §3, §10).
   Writes the extracted script to a temp .js and runs `node --check` on it,
   so a syntax error can never reach a deploy. */
import {writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {extractScript} from './query-extract.mjs';

const src=extractScript();
const dir=mkdtempSync(join(tmpdir(),'qcheck-'));
const f=join(dir,'query-engine.js');
writeFileSync(f,src,'utf8');
try{
  execFileSync(process.execPath,['--check',f],{stdio:'pipe'});
  console.log(`node --check OK  (${src.length.toLocaleString()} chars of inline JS)`);
}catch(e){
  console.error('node --check FAILED');
  console.error(e.stderr?.toString()||e.message);
  process.exit(1);
}
