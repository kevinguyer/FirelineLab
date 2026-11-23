import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('./',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);const file=path.resolve(root,'.'+relative);if(!file.startsWith(root)||!['.html','.js','.css','.svg'].includes(path.extname(file)))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.setHeader('Cache-Control','no-cache');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log('FirelineLab: http://127.0.0.1:4173'));
