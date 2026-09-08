import {mkdir,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await rm(path.join(root,'dist'),{recursive:true,force:true});
await mkdir(path.join(root,'dist'),{recursive:true});
await cp(path.join(root,'src'),path.join(root,'dist/src'),{recursive:true});
let html=await readFile(path.join(root,'index.html'),'utf8');
await writeFile(path.join(root,'dist/index.html'),html);
await writeFile(path.join(root,'dist/.nojekyll'),'');
const css=await readFile(path.join(root,'src/styles.css'),'utf8');
const model=(await readFile(path.join(root,'src/model.js'),'utf8')).replace(/^export /gm,'');
const app=(await readFile(path.join(root,'src/app.js'),'utf8')).replace(/^import .*?;\s*\n/,'');
html=html.replace('<link rel="stylesheet" href="./src/styles.css">',()=>`<style>${css}</style>`)
  .replace('<script type="module" src="./src/app.js"></script>',()=>`<script type="module">\n${model}\n${app}\n</script>`)
  .replace("script-src 'self'","script-src 'unsafe-inline'")
  .replace("style-src 'self'","style-src 'unsafe-inline'");
await writeFile(path.join(root,'dist/life-atlas-offline.html'),html);
console.log('Built dist/ and self-contained dist/life-atlas-offline.html. No install or network required.');
