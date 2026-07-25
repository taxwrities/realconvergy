/* ================================================================
   query-extract — pull the single <script> body out of public/query.html
   so the engine can be node --check'd and unit-tested headlessly.
   Shared by query.check.mjs, query.test.mjs and query.jsdom.mjs.
================================================================ */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const HERE=dirname(fileURLToPath(import.meta.url));
export const QUERY_HTML=join(HERE,'..','public','query.html');

export function readHtml(){return readFileSync(QUERY_HTML,'utf8')}

/* the page has exactly one <script> block (no src attributes) */
export function extractScript(html=readHtml()){
  const m=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  if(m.length!==1)throw new Error(`expected exactly 1 inline <script>, found ${m.length}`);
  return m[0][1];
}
