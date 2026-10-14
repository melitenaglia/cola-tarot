// Soy Amor Cloudflare Worker, entorno aislado.
import { handleAPI } from './backend.js';
import publicHtml from '../site/index.html';
import adminHtml from '../site/admin.html';
import css from '../site/styles.css';
import compat from './compat.txt';
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin'};
export default { async fetch(request,env){
 const url=new URL(request.url);
 const path=url.pathname;
 if(path==='/health'){
  try {
   const x=await env.DB.prepare('SELECT 1 AS ok').first();
   return Response.json({servicio:'soy-amor-eventos',entorno:'staging',online:true,database:x?.ok===1?'conectada':'error'},{headers});
  }catch{return Response.json({error:'D1 no disponible'},{status:503,headers});}
 }
 if(path.startsWith('/api/')||path.startsWith('/media/'))return handleAPI(request,env,url);
 if(request.method!=='GET')return new Response('Método no permitido',{status:405,headers});
 if(path==='/admin')return Response.redirect(url.origin+'/admin/',308);
 if(path==='/styles.css')return new Response(css,{headers:{...headers,'content-type':'text/css; charset=utf-8'}});
 if(path==='/compat.js')return new Response(compat,{headers:{...headers,'content-type':'application/javascript; charset=utf-8'}});
 const page=path==='/admin/'?adminHtml:path==='/'?publicHtml:null;
 if(page){
  const served=env.APP_ENV==='production'?page.replace(/<div data-staging-banner[^>]*>[\s\S]*?<\/div>/,''):page;
  return new Response(served,{headers:{...headers,'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'"}});
 }
 return new Response('No encontrado',{status:404,headers});
}};
