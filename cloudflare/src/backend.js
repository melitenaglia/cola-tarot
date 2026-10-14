// Backend de staging Soy Amor Universal 111. Exclusivamente Cloudflare D1.
const flags={events:['show_upcoming'],services:['active','included_with_entry','customized'],service_templates:['active','included_with_entry'],app_settings:[],turns:[],admins:['active']};
const columns={
 events:'name event_code description starts_at ends_at queue_opens_at queue_closes_at location_name location_address maps_url official_url image_url status queue_status show_upcoming current_number now_serving_number max_turns created_by deleted_at updated_at',
 services:'event_id template_id name description duration_minutes price_cents currency sort_order active included_with_entry customized whatsapp_extra updated_at',
 service_templates:'name description duration_minutes price_cents currency included_with_entry whatsapp_extra sort_order active updated_at',
 app_settings:'brand_name whatsapp_number instagram_url website_url google_review_url public_subtitle whatsapp_instruction waiting_message completed_title completed_message review_prompt closed_message updated_at'
};
const tables=['events','services','service_templates','turns','app_settings','profiles'];
const safeName=(t,n)=>!!n&&/^[a-z_]+$/.test(n)&&({events:'id '+columns.events+' created_at',services:'id '+columns.services+' created_at',service_templates:'id '+columns.service_templates+' created_at',turns:'id event_id service_id number code device_token status created_at updated_at',app_settings:'id '+columns.app_settings,profiles:'user_id display_name email role active created_at updated_at'}[t]||'').split(' ').includes(n);
const result=(data,status=200,extra={})=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const fail=(message,status=400)=>result({error:message},status);
const iso=()=>new Date().toISOString();
const hex=(b)=>Array.from(new Uint8Array(b)).map(v=>v.toString(16).padStart(2,'0')).join('');
const sha=async(s)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
const salt=()=>hex(crypto.getRandomValues(new Uint8Array(16)));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
async function passhash(password,s) {
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new Uint8Array(s.match(/.{2}/g).map(x=>parseInt(x,16))),iterations:100000,hash:'SHA-256'},key,256));
}
const normalize=(table,row)=>{
 if(!row)return row;
 const x={...row};
 for(const k of flags[table]||[])if(k in x)x[k]=!!x[k];
 if(table==='admins'){x.user_id=x.id;delete x.password_hash;delete x.password_salt;}
 return x;
};
const getBody=async(req)=>{const txt=await req.text();if(txt.length>60000)throw Error('Solicitud demasiado grande');return JSON.parse(txt||'{}')};
function validOrigin(request,url) {
 const origin=request.headers.get('origin');
 if(!origin||origin!==url.origin)return false;
 return (request.headers.get('content-type')||'').startsWith('application/json');
}
async function currentUser(request,db) {
 const cookie=request.headers.get('cookie')||'';
 const value=cookie.match(/(?:^|;\s*)sau_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(!value)return null;
 const hash=await sha(value);
 return db.prepare('SELECT a.id,a.email,a.display_name,a.role,a.active FROM sessions s JOIN admins a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND a.active=1').bind(hash,iso()).first();
}
function filtersSQL(table,filters,bind) {
 let sql='';
 for(const f of filters||[]){
  if(!safeName(table,f.key))throw Error('Campo de filtro no permitido');
  if(f.op==='eq'){sql+=' AND '+f.key+' = ?';bind.push(f.value===true?1:f.value===false?0:f.value);}
  else if(f.op==='is'&&f.value===null)sql+=' AND '+f.key+' IS NULL';
  else if(f.op==='not'&&f.value===null)sql+=' AND '+f.key+' IS NOT NULL';
  else throw Error('Operador no permitido');
 }
 return sql;
}
async function readTable(db,table,q,admin) {
 if(!tables.includes(table))throw Error('Tabla no disponible');
 if(!admin&&!['events','services','app_settings'].includes(table))throw Error('Acceso restringido');
 if(table==='profiles'){
  const rows=admin.role==='admin'?(await db.prepare('SELECT id,email,display_name,role,active,created_at,updated_at FROM admins ORDER BY created_at').all()).results:[await db.prepare('SELECT id,email,display_name,role,active,created_at,updated_at FROM admins WHERE id=?').bind(admin.id).first()];
  return rows.filter(x=>x&&(admin.role==='admin'||x.id===admin.id)&&!(q.filters||[]).some(f=>f.key==='user_id'&&f.op==='eq'&&f.value!==x.id)).map(x=>normalize('admins',x));
 }
 const binds=[];
 let where='WHERE 1=1';
 if(!admin){
  if(table==='events')where+=" AND status='published' AND deleted_at IS NULL";
  if(table==='services')where+=" AND active=1 AND event_id IN (SELECT id FROM events WHERE status='published' AND deleted_at IS NULL)";
 }
 where+=filtersSQL(table,q.filters,binds);
 let order='';
 const sorts=(q.orders||[]).filter(x=>safeName(table,x.key)).slice(0,3);
 if(sorts.length)order=' ORDER BY '+sorts.map(x=>x.key+(x.ascending===false?' DESC':' ASC')).join(',');
 const lim=Math.min(Math.max(Number(q.limit)||500,1),1000);
 const publicColumns=table==='events'&&!admin ? 'id,name,event_code,description,starts_at,ends_at,queue_opens_at,queue_closes_at,location_name,location_address,maps_url,official_url,image_url,status,queue_status,show_upcoming,current_number,now_serving_number,max_turns' : table==='turns' ? 'id,event_id,service_id,number,code,status,created_at,updated_at' : '*';
 const rows=(await db.prepare('SELECT '+publicColumns+' FROM '+table+' '+where+order+' LIMIT '+lim).bind(...binds).all()).results.map(x=>normalize(table,x));
 if(table==='events'&&admin&&/services\(|turns\(/.test(q.select||'')){
  for(const row of rows){
   if((q.select||'').includes('services('))row.services=(await db.prepare('SELECT * FROM services WHERE event_id=? ORDER BY sort_order').bind(row.id).all()).results.map(x=>normalize('services',x));
   row.turns=(await db.prepare('SELECT id,number,code,status,created_at,updated_at,service_id FROM turns WHERE event_id=? ORDER BY number').bind(row.id).all()).results;
  }
 }
 if(table==='turns'&&admin&&(q.select||'').includes('services(')){
  for(const row of rows)row.services=row.service_id?normalize('services',await db.prepare('SELECT name,duration_minutes,price_cents,included_with_entry FROM services WHERE id=?').bind(row.service_id).first()):null;
 }
 return rows;
}
async function writeTable(db,table,q,admin) {
 if(!admin)throw Error('Acceso restringido');
 if(!columns[table])throw Error('Tabla no editable');
 if(table==='app_settings'&&admin.role!=='admin')throw Error('Solo administradores');
 if(table==='service_templates'&&admin.role!=='admin')throw Error('Solo administradores');
 if(q.op!=='insert'&&q.op!=='update')throw Error('Operación no permitida');
 const all=Array.isArray(q.payload)?q.payload:[q.payload];
 if(all.length>40||!all.length)throw Error('Cantidad inválida');
 const writable=columns[table].split(' ');
 if(q.op==='update'&&!(q.filters||[]).length)throw Error('Se requiere seleccionar el registro');
 const out=[];
 for(const input of all){
  if(!input||typeof input!=='object')throw Error('Datos no válidos');
  const obj={};
  for(const [k,v] of Object.entries(input)){
   if(!writable.includes(k))continue;
   if(k==='created_by'){obj[k]=admin.id;continue}
   if(typeof v==='string'&&v.length>10000)throw Error('Texto demasiado largo');
   obj[k]=v===true?1:v===false?0:v;
  }
  if(q.op==='insert'){
   if(table==='app_settings')throw Error('No se puede crear configuración');
   if(table==='events'){obj.created_by=admin.id;obj.id=crypto.randomUUID()}
   else obj.id=crypto.randomUUID();
   if(!Object.keys(obj).length)throw Error('Datos vacíos');
   const keys=Object.keys(obj),vals=Object.values(obj);
   const rs=await db.prepare('INSERT INTO '+table+' ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+') RETURNING *').bind(...vals).first();
   out.push(normalize(table,rs));
  }else {
   const ids=[];const where=filtersSQL(table,q.filters,ids);
   if(!Object.keys(obj).length)throw Error('Datos vacíos');
   const keys=Object.keys(obj);
   const rs=(await db.prepare('UPDATE '+table+' SET '+keys.map(x=>x+'=?').join(',')+' WHERE 1=1 '+where+' RETURNING *').bind(...Object.values(obj),...ids).all()).results;
   out.push(...rs.map(x=>normalize(table,x)));
  }
 }
 return out;
}
async function queueRpc(db,name,p,admin,request) {
 const id=p.p_event_id;
 if(name==='get_queue_position'){
  const ev=await db.prepare('SELECT id FROM events WHERE id=? AND deleted_at IS NULL AND status=?').bind(id,'published').first();
  if(!ev)throw Error('El evento no está disponible.');
  const token=String(p.p_device_token||'').slice(0,200);
  const t=token?await db.prepare('SELECT number,status FROM turns WHERE event_id=? AND device_token=?').bind(id,token).first():null;
  const [current,count,ahead]=await Promise.all([
   db.prepare("SELECT MIN(number) n FROM turns WHERE event_id=? AND status IN ('issued','called','in_service')").bind(id).first(),
   db.prepare("SELECT COUNT(*) n FROM turns WHERE event_id=? AND status IN ('issued','called','in_service')").bind(id).first(),
   t?db.prepare("SELECT COUNT(*) n FROM turns WHERE event_id=? AND number<? AND status IN ('issued','called','in_service')").bind(id,t.number).first():null
  ]);
  return [{event_id:id,current_turn_number:current.n,waiting_count:count.n,user_turn_number:t?.number??null,people_ahead:ahead?.n??null,user_status:t?.status??null}];
 }
 if(name==='issue_turn'){
  const token=String(p.p_device_token||'').trim();
  if(token.length<12||token.length>200)throw Error('No pudimos identificar este dispositivo.');
  const old=await db.prepare('SELECT * FROM turns WHERE event_id=? AND device_token=?').bind(id,token).first();
  if(old)return [normalize('turns',old)];
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  const rk=await sha('issue:'+ip+':'+id);
  const now=Date.now(), period=600000;
  const rl=await db.prepare('SELECT attempts,window_start FROM login_attempts WHERE identifier=?').bind(rk).first();
  if(rl&&now-rl.window_start<period&&rl.attempts>=10)throw Error('Demasiados intentos. Probá más tarde.');
  await db.prepare('INSERT INTO login_attempts(identifier,attempts,window_start) VALUES(?,?,?) ON CONFLICT(identifier) DO UPDATE SET attempts=CASE WHEN excluded.window_start-login_attempts.window_start<? THEN login_attempts.attempts+1 ELSE 1 END,window_start=CASE WHEN excluded.window_start-login_attempts.window_start<? THEN login_attempts.window_start ELSE excluded.window_start END').bind(rk,1,now,period,period).run();
  const ev=await db.prepare('SELECT * FROM events WHERE id=? AND deleted_at IS NULL').bind(id).first();
  if(!ev||ev.status!=='published')throw Error('El evento no está disponible.');
  if(ev.queue_status!=='open'||ev.queue_opens_at&&Date.now()<Date.parse(ev.queue_opens_at)||ev.queue_closes_at&&Date.now()>=Date.parse(ev.queue_closes_at))throw Error('La lista de espera está cerrada.');
  if(ev.max_turns!=null&&ev.current_number>=ev.max_turns)throw Error('La lista está completa.');
  const svcs=(await db.prepare('SELECT id FROM services WHERE event_id=? AND active=1').bind(id).all()).results;
  let sid=p.p_service_id||null;
  if(sid&&!svcs.some(x=>x.id===sid))throw Error('La lectura elegida no está disponible.');
  if(!sid&&svcs.length===1)sid=svcs[0].id;
  if(!sid&&svcs.length>1)throw Error('Elegí una lectura antes de sacar turno.');
  const tId=crypto.randomUUID();
  try {
   const ret=await db.batch([
    db.prepare("UPDATE events SET current_number=current_number+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='published' AND queue_status='open' AND deleted_at IS NULL AND (max_turns IS NULL OR current_number<max_turns) AND (queue_opens_at IS NULL OR unixepoch(queue_opens_at)<=unixepoch('now')) AND (queue_closes_at IS NULL OR unixepoch(queue_closes_at)>unixepoch('now')) AND NOT EXISTS(SELECT 1 FROM turns WHERE event_id=? AND device_token=?) RETURNING current_number").bind(id,id,token),
    db.prepare("INSERT INTO turns(id,event_id,service_id,number,code,device_token,status) SELECT ?,e.id,?,e.current_number,e.event_code||'-T'||printf('%03d',e.current_number),?,'issued' FROM events e WHERE e.id=? AND changes()=1 RETURNING *").bind(tId,sid,token,id)
   ]);
   const turn=ret[1].results?.[0];
   if(turn)return [normalize('turns',turn)];
  }catch(e){
   const found=await db.prepare('SELECT * FROM turns WHERE event_id=? AND device_token=?').bind(id,token).first();
   if(found)return [normalize('turns',found)];
   throw e;
  }
  const again=await db.prepare('SELECT * FROM turns WHERE event_id=? AND device_token=?').bind(id,token).first();
  if(again)return [normalize('turns',again)];
  throw Error('No se pudo asignar el turno.');
 }
 if(!admin)throw Error('Acceso restringido');
 if(name==='set_event_queue'){
  if(p.p_open){
   const ev=await db.prepare('SELECT id FROM events WHERE id=? AND deleted_at IS NULL').bind(id).first();
   if(!ev)throw Error('Evento no encontrado');
   await db.batch([
    db.prepare("UPDATE events SET queue_status='closed',updated_at=CURRENT_TIMESTAMP WHERE queue_status='open' AND id<>?").bind(id),
    db.prepare("UPDATE events SET status='published',queue_status='open',updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL").bind(id)
   ]);
  }else await db.prepare("UPDATE events SET queue_status='closed',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
  return await db.prepare('SELECT * FROM events WHERE id=?').bind(id).first();
 }
 if(name==='set_turn_attended'){
  const t=await db.prepare('SELECT * FROM turns WHERE id=?').bind(p.p_turn_id).first();
  if(!t)throw Error('El turno no existe');
  await db.batch([
   db.prepare('UPDATE turns SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(p.p_attended?'done':'issued',t.id),
   db.prepare("UPDATE events SET now_serving_number=COALESCE((SELECT MIN(number) FROM turns WHERE event_id=? AND status IN ('issued','called','in_service')),0),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(t.event_id,t.event_id)
  ]);
  return [{turn_id:t.id,event_id:t.event_id,number:t.number,code:t.code,status:p.p_attended?'done':'issued'}];
 }
 if(admin.role!=='admin')throw Error('Solo administradores');
 if(name==='trash_event'){
  const x=await db.prepare("UPDATE events SET deleted_at=CURRENT_TIMESTAMP,queue_status='closed',status='cancelled',show_upcoming=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL RETURNING id").bind(id).first();
  if(!x)throw Error('Evento no encontrado');return true;
 }
 if(name==='restore_event'){
  const ev=await db.prepare('SELECT * FROM events WHERE id=? AND deleted_at IS NOT NULL').bind(id).first();
  if(!ev)throw Error('El evento no está en la papelera');
  const other=await db.prepare('SELECT id FROM events WHERE event_code=? AND deleted_at IS NULL AND id<>?').bind(ev.event_code,id).first();
  if(other)throw Error('Ya existe un evento con el mismo código');
  await db.prepare("UPDATE events SET deleted_at=NULL,status='published',queue_status='closed',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();return true;
 }
 if(name==='permanently_delete_event'){
  if(String(p.p_confirmation||'').trim().toUpperCase()!=='ELIMINAR')throw Error('Confirmación incorrecta');
  const x=await db.prepare('DELETE FROM events WHERE id=? AND deleted_at IS NOT NULL RETURNING id').bind(id).first();
  if(!x)throw Error('El evento debe estar en la papelera');return true;
 }
 throw Error('Operación desconocida');
}
export async function handleAPI(request,env,url) {
 const db=env.DB;
 if(!db)return fail('Base de datos no disponible',503);
 const method=request.method;
 if(method!=='GET'&&!validOrigin(request,url))return fail('Origen no autorizado',403);
 const path=url.pathname;
 try {
  if(path==='/api/auth/session'&&method==='GET'){
   const a=await currentUser(request,db);
   return result({session:a?{user:{id:a.id,email:a.email},access_token:'cookie-session'}:null});
  }
  // Migración de identidad UNA SOLA VEZ: verifica credenciales en Supabase
  // y guarda un hash independiente en D1. Ningún token de Supabase se conserva.
  if(path==='/api/auth/migrate'&&method==='POST'){
   const b=await getBody(request),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<6||password.length>128)return fail('Credenciales incorrectas',401);
   const prior=await db.prepare('SELECT id,password_hash FROM admins WHERE email=?').bind(email).first();
   if(prior?.password_hash)return fail('Credenciales incorrectas',401);
   const key=await sha('login:'+email+':'+(request.headers.get('cf-connecting-ip')||'unknown'));
   const prev=await db.prepare('SELECT attempts,window_start FROM login_attempts WHERE identifier=?').bind(key).first();
   if(prev&&Date.now()-prev.window_start<900000&&prev.attempts>=7)return fail('Demasiados intentos. Probá más tarde.',429);
   const source='https://yczzfhfyrkmgqsblmeze.supabase.co';
   const publishable='sb_publishable_uEqn4LVE35RXydGiTDQ-0g_nRBKgaWz';
   const signed=await fetch(source+'/auth/v1/token?grant_type=password',{
     method:'POST',headers:{'content-type':'application/json',apikey:publishable},
     body:JSON.stringify({email,password}),signal:AbortSignal.timeout(12000)
   });
   if(!signed.ok)return fail('Credenciales incorrectas',401);
   const credentials=await signed.json();
   if(!credentials?.access_token||!credentials?.user?.id||String(credentials.user.email||'').toLowerCase()!==email)return fail('No se pudo validar el usuario',401);
   const profileResponse=await fetch(source+'/rest/v1/profiles?select=user_id,email,display_name,role,active&user_id=eq.'+encodeURIComponent(credentials.user.id),{
    headers:{apikey:publishable,authorization:'Bearer '+credentials.access_token,accept:'application/json'},
    signal:AbortSignal.timeout(12000)
   });
   if(!profileResponse.ok)return fail('No se pudieron verificar los permisos',403);
   const profiles=await profileResponse.json(),p=profiles?.find(x=>x.user_id===credentials.user.id&&x.active===true&&['admin','staff'].includes(x.role)&&String(x.email||'').toLowerCase()===email);
   if(!p)return fail('El usuario no tiene acceso al panel',403);
   const ps=salt(),ph=await passhash(password,ps),id=crypto.randomUUID();
   if(!prior)await db.prepare('INSERT OR IGNORE INTO admins(id,email,display_name,role,active) VALUES(?,?,?,?,1)').bind(id,email,String(p.display_name||'').slice(0,120),p.role).run();
   const saved=await db.prepare('UPDATE admins SET display_name=?,role=?,active=1,password_salt=?,password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE email=? AND password_hash IS NULL RETURNING id').bind(String(p.display_name||'').slice(0,120),p.role,ps,ph,email).first();
   if(!saved)return fail('La cuenta ya está activada. Iniciá sesión de nuevo.',409);
   return result({ok:true,migrated:true});
  }
  if(path==='/api/auth/login'&&method==='POST'){
   const b=await getBody(request),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
   const key=await sha('login:'+email+':'+(request.headers.get('cf-connecting-ip')||'unknown'));
   const prev=await db.prepare('SELECT * FROM login_attempts WHERE identifier=?').bind(key).first(),now=Date.now();
   if(prev&&now-prev.window_start<900000&&prev.attempts>=7)return fail('Demasiados intentos. Probá más tarde.',429);
   const a=await db.prepare('SELECT * FROM admins WHERE email=? AND active=1').bind(email).first();
   let ok=false;
   if(a?.password_hash&&a.password_salt){ok=(await passhash(password,a.password_salt))===a.password_hash;}
   if(!ok){
    await db.prepare('INSERT INTO login_attempts(identifier,attempts,window_start) VALUES(?,?,?) ON CONFLICT(identifier) DO UPDATE SET attempts=CASE WHEN excluded.window_start-login_attempts.window_start<900000 THEN login_attempts.attempts+1 ELSE 1 END,window_start=CASE WHEN excluded.window_start-login_attempts.window_start<900000 THEN login_attempts.window_start ELSE excluded.window_start END').bind(key,1,now).run();
    return fail('Correo o contraseña incorrectos',401);
   }
   await db.prepare('DELETE FROM login_attempts WHERE identifier=?').bind(key).run();
   const token=random(),expires=new Date(Date.now()+7*86400000).toISOString();
   await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await sha(token),a.id,expires).run();
   return result({session:{user:{id:a.id,email:a.email},access_token:'cookie-session'}},200,{'set-cookie':'sau_session='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800'});
  }
  if(path==='/api/auth/logout'&&method==='POST'){
   const token=(request.headers.get('cookie')||'').match(/sau_session=([a-f0-9]{64})/)?.[1];
   if(token)await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha(token)).run();
   return result({ok:true},200,{'set-cookie':'sau_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
  }
  if(path==='/api/auth/activate'&&method==='POST'){
   const b=await getBody(request),token=String(b.token||''),password=String(b.password||'');
   if(!/^[a-f0-9]{64}$/.test(token)||password.length<12||password.length>128)return fail('Enlace o contraseña no válidos');
   const hash=await sha(token);
   const invite=await db.prepare('SELECT i.user_id FROM auth_invites i JOIN admins a ON a.id=i.user_id WHERE i.token_hash=? AND i.used_at IS NULL AND i.expires_at>? AND a.active=1').bind(hash,iso()).first();
   if(!invite)return fail('El enlace venció o ya fue utilizado',401);
   const s=salt(),h=await passhash(password,s);
   // La eliminación del enlace y actualización ocurren en una misma transacción.
   const activation=await db.batch([
    db.prepare('UPDATE auth_invites SET used_at=CURRENT_TIMESTAMP WHERE token_hash=? AND used_at IS NULL AND expires_at>?').bind(hash,iso()),
    db.prepare('UPDATE admins SET password_salt=?,password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND changes()=1').bind(s,h,invite.user_id),
    db.prepare('DELETE FROM sessions WHERE user_id=?').bind(invite.user_id)
   ]);
   if((activation[0]?.meta?.changes||0)!==1||(activation[1]?.meta?.changes||0)!==1)return fail('El enlace ya se usó',401);
   return result({ok:true});
  }
  const admin=await currentUser(request,db);
  if(path.startsWith('/media/')&&method==='GET'){
   const key=path.slice(7);
   if(!/^[0-9a-f-]{36}$/.test(key))return fail('No encontrado',404);
   const media=await db.prepare('SELECT content,mime FROM media WHERE path=?').bind(key).first();
   if(!media)return fail('No encontrado',404);
   return new Response(media.content,{headers:{'content-type':media.mime,'cache-control':'public, max-age=86400','x-content-type-options':'nosniff'}});
  }
  if(path.startsWith('/api/data/')&&method==='GET'){
   const table=path.split('/').pop(),q=JSON.parse(url.searchParams.get('q')||'{}');
   return result({data:await readTable(db,table,q,admin)});
  }
  if(path.startsWith('/api/data/')&&method==='POST'){
   const table=path.split('/').pop(),q=await getBody(request);
   return result({data:await writeTable(db,table,q,admin)});
  }
  if(path==='/api/rpc'&&method==='POST'){
   const {name,params}=await getBody(request);
   return result({data:await queueRpc(db,name,params||{},admin,request)});
  }
  if(path==='/api/auth/change-password'&&method==='POST'){
   if(!admin)return fail('Sesión no iniciada',401);
   const b=await getBody(request),newpass=String(b.password||'');
   if(newpass.length<12||newpass.length>128)return fail('La contraseña debe tener al menos 12 caracteres');
   const x=salt(),h=await passhash(newpass,x);
   await db.prepare('UPDATE admins SET password_salt=?,password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(x,h,admin.id).run();
   await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(admin.id).run();
   return result({ok:true});
  }
  if(path==='/api/media/upload'&&method==='POST'){
   // JSON data-URL image, compacta WebP/JPEG; R2 todavía no disponible.
   if(!admin)return fail('Iniciá sesión',401);
   const b=await (async()=>{const raw=await request.text();if(raw.length>650000)throw Error('Archivo demasiado grande');return JSON.parse(raw)})(),content=String(b.base64||''),mime=String(b.mime||'');
   if(!['image/webp','image/jpeg','image/png'].includes(mime)||content.length>540000||!/^[A-Za-z0-9+/=]+$/.test(content))return fail('La imagen debe ser WebP/JPG/PNG y pesar menos de 400 KB');
   const bin=Uint8Array.from(atob(content),x=>x.charCodeAt(0));
   if(bin.length>400000)return fail('Imagen demasiado grande');
   const key=crypto.randomUUID();
   await db.prepare('INSERT INTO media(path,mime,content) VALUES(?,?,?)').bind(key,mime,bin.buffer).run();
   return result({path:key,url:'/media/'+key});
  }
  if(path.startsWith('/api/admin/')&&method==='POST'){
   if(!admin||admin.role!=='admin')return fail('Solo administradores',403);
   const b=await getBody(request);
   if(path==='/api/admin/create-user'){
    const email=String(b.email||'').trim().toLowerCase(),role=b.role==='staff'?'staff':'admin';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail('Correo inválido');
    const id=crypto.randomUUID();
    await db.prepare('INSERT INTO admins(id,email,display_name,role,active) VALUES(?,?,?,?,1)').bind(id,email,String(b.display_name||'').slice(0,120),role).run();
    if(b.password&&String(b.password).length>=12){const x=salt();await db.prepare('UPDATE admins SET password_hash=?,password_salt=? WHERE id=?').bind(await passhash(String(b.password),x),x,id).run();return result({ok:true});}
    const token=random();
    await db.prepare('INSERT INTO auth_invites(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha(token),id,new Date(Date.now()+48*3600000).toISOString()).run();
    return result({ok:true,activation_url:url.origin+'/admin/?activar='+token});
   }
   if(path==='/api/admin/update-user'){
    const id=String(b.user_id||'');
    const target=await db.prepare('SELECT * FROM admins WHERE id=?').bind(id).first();
    if(!target)return fail('Usuario no encontrado',404);
    const role=b.role==='staff'?'staff':'admin',active=b.active?1:0;
    if(target.role==='admin'&&(role!=='admin'||!active)){
     const x=await db.prepare('SELECT COUNT(*) n FROM admins WHERE role=? AND active=1').bind('admin').first();
     if(x.n<=1)return fail('Debe quedar al menos un administrador');
    }
    await db.prepare('UPDATE admins SET display_name=?,email=?,role=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(String(b.display_name||'').slice(0,120),String(b.email||'').trim().toLowerCase(),role,active,id).run();
    if(!active)await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();
    let activation_url=null;
    if(b.password&&String(b.password).length>=12){
     const s=salt(),h=await passhash(String(b.password),s);
     await db.batch([db.prepare('UPDATE admins SET password_salt=?,password_hash=? WHERE id=?').bind(s,h,id),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id)]);
    }else if(b.send_activation){
     const token=random();
     await db.prepare('INSERT INTO auth_invites(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha(token),id,new Date(Date.now()+48*3600000).toISOString()).run();
     activation_url=url.origin+'/admin/?activar='+token;
    }
    return result({ok:true,activation_url});
   }
  }
  return fail('API no encontrada',404);
 }catch(e){
  console.error('API error',e);
  const msg=String(e.message||'');
  const expected=[
   'Acceso restringido','Solo administradores','Solo un administrador','No tenés permiso',
   'No encontrado','Evento no encontrado','El evento no está disponible.','La lista de espera está cerrada.',
   'La lista está completa.','La lectura elegida no está disponible.',
   'Elegí una lectura antes de sacar turno.','No se pudo asignar el turno.',
   'Demasiados intentos. Probá más tarde.','Correo o contraseña incorrectos'
  ];
  const publicMessage=expected.includes(msg)?msg:'No se pudo completar la operación. Volvé a intentarlo.';
  return fail(publicMessage,/Acceso restringido|administradores/.test(msg)?403:400);
 }
}
