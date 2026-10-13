// Staging independiente de Soy Amor. Solo lectura pública; ninguna escritura habilitada.
const reply=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(!env.DB)return reply({error:"D1 no configurada"},503);
 try {
  if(request.method==="GET"&&url.pathname==="/health"){
   const r=await env.DB.prepare("SELECT 1 AS ok").first();
   return reply({servicio:"soy-amor-eventos",entorno:"staging",online:true,database:r?.ok===1?"conectada":"error"});
  }
  if(request.method==="GET"&&url.pathname==="/api/public/settings"){
   return reply({settings:(await env.DB.prepare("SELECT * FROM app_settings WHERE id=1").first())||{}});
  }
  if(request.method==="GET"&&url.pathname==="/api/public/events"){
   const {results}=await env.DB.prepare("SELECT id,name,event_code,description,starts_at,ends_at,queue_opens_at,queue_closes_at,location_name,location_address,maps_url,official_url,image_url,queue_status,show_upcoming,current_number,now_serving_number,max_turns FROM events WHERE status='published' AND deleted_at IS NULL ORDER BY starts_at DESC LIMIT 50").all();
   return reply({events:results});
  }
  const match=url.pathname.match(/^\/api\/public\/events\/([a-zA-Z0-9-]+)$/);
  if(request.method==="GET"&&match){
   const event=await env.DB.prepare("SELECT id,name,event_code,description,starts_at,ends_at,queue_opens_at,queue_closes_at,location_name,location_address,maps_url,official_url,image_url,queue_status,current_number,now_serving_number,max_turns FROM events WHERE id=? AND status='published' AND deleted_at IS NULL").bind(match[1]).first();
   if(!event)return reply({error:"No encontrado"},404);
   const {results:services}=await env.DB.prepare("SELECT id,name,description,duration_minutes,price_cents,currency,included_with_entry,sort_order,whatsapp_extra FROM services WHERE event_id=? AND active=1 ORDER BY sort_order").bind(event.id).all();
   return reply({event,services});
  }
  if(url.pathname==="/"&&request.method==="GET"){
   return new Response('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow"><title>Soy Amor · Staging</title><body style="font:17px system-ui;margin:8%;max-width:680px"><h1>Soy Amor Eventos · Staging</h1><p>Plataforma de pruebas en Cloudflare D1. Los turnos reales siguen en producción.</p><p><a href="/health">Comprobar conexión D1</a> · <a href="/api/public/events">Consultar eventos de prueba</a></p></body></html>',{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
  }
  return reply({error:"No encontrado"},404);
 }catch(e){console.error("Staging D1",e);return reply({error:"Error de consulta"},500)}
}};
