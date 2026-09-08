import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
http.createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const target=path.resolve(root,'.'+pathname);
    if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403).end('Forbidden');return;}
    const allowed=pathname==='/'||pathname==='/index.html'||/^\/src\/[\w.-]+$/.test(pathname)||/^\/dist\/(?:index.html|life-atlas-offline.html|src\/[\w.-]+)$/.test(pathname);
    if(!allowed){res.writeHead(404).end('Not found');return;}
    const file=(await stat(target)).isDirectory()?path.join(target,'index.html'):target;
    const content=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    res.end(req.method==='HEAD'?undefined:content);
  }catch{res.writeHead(404).end('Not found');}
}).listen(port,host,()=>console.log(`Life Atlas: http://${host}:${port}`));
