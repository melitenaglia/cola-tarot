import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { handleAPI } from '../src/backend.js';

const sqlite=new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/0002_auth_media.sql',import.meta.url),'utf8'));
class MockDB {
 prepare(sql){
  let params=[];
  return {
   sql,
   bind(...args){params=args;return this;},
   get params(){return params},
   async first(){return sqlite.prepare(sql).get(...params)||null},
   async all(){return {results:sqlite.prepare(sql).all(...params)}},
   async run(){const r=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(r.changes)}}}
  };
 }
 async batch(statements){
  sqlite.exec('BEGIN IMMEDIATE');
  try {
   const rows=[];
   for(const s of statements){
    const stmt=sqlite.prepare(s.sql),returns=/(?:\bRETURNING\b)|(?:^\s*SELECT\b)/i.test(s.sql);
    const results=returns?stmt.all(...s.params):[];
    if(!returns)stmt.run(...s.params);
    const changes=Number(sqlite.prepare('SELECT changes() c').get().c);
    rows.push({results,meta:{changes}});
   }
   sqlite.exec('COMMIT');
   return rows;
  } catch(e){sqlite.exec('ROLLBACK');throw e;}
 }
}
const DB=new MockDB();
const insert=(sql,...v)=>sqlite.prepare(sql).run(...v);
insert("INSERT INTO events(id,name,event_code,starts_at,ends_at,status,queue_status,show_upcoming,max_turns) VALUES(?,?,?,?,?,'published','open',1,2)",'demo','Evento de prueba','DEMO01','2026-10-01T16:00:00Z','2027-11-01T23:00:00Z');
insert("INSERT INTO services(id,event_id,name,active) VALUES(?,?,?,1)",'svc1','demo','Tarot');
insert("INSERT INTO app_settings(id,brand_name) VALUES(1,?)",'Soy Amor');
const base='https://test.local';
async function call(path,body,cookie=''){
 const url=new URL(path,base);
 const options=body===undefined?{method:'GET',headers:{cookie}}:{
  method:'POST',headers:{origin:base,'content-type':'application/json','cf-connecting-ip':'203.0.113.42',cookie},body:JSON.stringify(body)
 };
 const res=await handleAPI(new Request(url,options),{DB},url);
 return {status:res.status,body:await res.json(),headers:res.headers};
}
const pub=await call('/api/data/events');
assert.equal(pub.status,200);assert.equal(pub.body.data.length,1);
assert.equal(pub.body.data[0].queue_status,'open');
const privateData=await call('/api/data/turns');
assert.equal(privateData.status,403,'Public must not list private turns');
const blocked=await call('/api/data/events',{op:'update',filters:[{key:'id',op:'eq',value:'demo'}],payload:{name:'Ataque'}});
assert.equal(blocked.status,403,'Unauthenticated users cannot edit');
const t1=await call('/api/rpc',{name:'issue_turn',params:{p_event_id:'demo',p_device_token:'device-token-00000001'}});
assert.equal(t1.status,200,JSON.stringify(t1.body));assert.equal(t1.body.data[0].number,1);
const retry=await call('/api/rpc',{name:'issue_turn',params:{p_event_id:'demo',p_device_token:'device-token-00000001'}});
assert.equal(retry.body.data[0].number,1,'Same device must receive same turn');
const t2=await call('/api/rpc',{name:'issue_turn',params:{p_event_id:'demo',p_device_token:'device-token-00000002'}});
assert.equal(t2.body.data[0].number,2,'Second device receives unique next number');
const full=await call('/api/rpc',{name:'issue_turn',params:{p_event_id:'demo',p_device_token:'device-token-00000003'}});
assert.equal(full.status,400,'max_turns enforced');
const state=await call('/api/rpc',{name:'get_queue_position',params:{p_event_id:'demo',p_device_token:'device-token-00000002'}});
assert.equal(state.body.data[0].people_ahead,1);
const token='a'.repeat(64),hash=createHash('sha256').update(token).digest('hex');
insert("INSERT INTO admins(id,email,display_name,role,active) VALUES('admin','admin@example.invalid','Prueba','admin',1)");
insert("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",hash,'admin','2099-12-31T00:00:00Z');
const cookie='sau_session='+token;
const session=await call('/api/auth/session',undefined,cookie);
assert.equal(session.body.session.user.email,'admin@example.invalid');
const done=await call('/api/rpc',{name:'set_turn_attended',params:{p_turn_id:t1.body.data[0].id,p_attended:true}},cookie);
assert.equal(done.status,200,JSON.stringify(done.body));
const later=await call('/api/rpc',{name:'get_queue_position',params:{p_event_id:'demo',p_device_token:'device-token-00000002'}});
assert.equal(later.body.data[0].people_ahead,0);
const closed=await call('/api/rpc',{name:'set_event_queue',params:{p_event_id:'demo',p_open:false}},cookie);
assert.equal(closed.status,200);
const stopped=await call('/api/rpc',{name:'issue_turn',params:{p_event_id:'demo',p_device_token:'device-token-00000004'}});
assert.equal(stopped.status,400);
console.log('OK: lectura pública, privacidad, idempotencia, límites, posición, sesión, atención y cierre.');
