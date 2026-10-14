/* Soy Amor Cloudflare compatibility client. API same-origin; credentials only in HttpOnly cookies. */
(function(){
 const api=async(path,body)=>{
  const opts={credentials:'same-origin',cache:'no-store',headers:{}};
  if(body!==undefined){opts.method='POST';opts.headers['content-type']='application/json';opts.body=JSON.stringify(body);}
  const res=await fetch(path,opts);
  const payload=await res.json().catch(()=>({error:'Respuesta inválida'}));
  if(!res.ok)throw Error(payload.error||'No se pudo completar la operación');
  return payload;
 };
 class Query{
  constructor(table){this.table=table;this.q={filters:[],orders:[]};this.op='read';this.singleMode='';}
  select(fields){this.q.select=fields;return this}
  eq(key,value){this.q.filters.push({op:'eq',key,value});return this}
  is(key,value){this.q.filters.push({op:'is',key,value});return this}
  not(key,op,value){this.q.filters.push({op:'not',key,value});return this}
  order(key,opt={}){this.q.orders.push({key,ascending:opt.ascending!==false});return this}
  limit(n){this.q.limit=n;return this}
  maybeSingle(){this.singleMode='maybe';return this}
  single(){this.singleMode='single';return this}
  insert(payload){this.op='insert';this.payload=payload;return this}
  update(payload){this.op='update';this.payload=payload;return this}
  async run(){
   try{
    const data=this.op==='read'
      ?(await api('/api/data/'+this.table+'?q='+encodeURIComponent(JSON.stringify(this.q)))).data
      :(await api('/api/data/'+this.table,{op:this.op,filters:this.q.filters,payload:this.payload})).data;
    if(this.singleMode)return {data:data[0]||null,error:this.singleMode==='single'&&!data.length?{message:'No se encontró el registro'}:null};
    return {data,error:null};
   }catch(e){return {data:null,error:{message:e.message}}}
  }
  then(ok,bad){return this.run().then(ok,bad)}
 }
 const images=new Map();
 async function compress(file){
  if(!file.type.startsWith('image/'))throw Error('Seleccioná una imagen válida');
  const uri=URL.createObjectURL(file);
  try{
   const im=new Image();im.src=uri;await im.decode();
   const originalFactor=Math.min(1,1500/Math.max(im.naturalWidth,im.naturalHeight));
   const canvas=document.createElement('canvas');
   let blob=null;
   for(const scale of [1,.75,.55,.4,.3]){
    const factor=originalFactor*scale;
    canvas.width=Math.max(1,Math.round(im.naturalWidth*factor));canvas.height=Math.max(1,Math.round(im.naturalHeight*factor));
    canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);
    for(const quality of [.82,.68,.52,.4]){
     blob=await new Promise(r=>canvas.toBlob(r,'image/webp',quality));
     if(blob&&blob.size<390000)break;
    }
    if(blob&&blob.size<390000)break;
   }
   if(!blob||blob.size>390000)throw Error('No se pudo comprimir la imagen para guardarla');
   const bytes=new Uint8Array(await blob.arrayBuffer());
   let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));
   return {base64:btoa(s),mime:blob.type};
  }finally{URL.revokeObjectURL(uri)}
 }
 const auth={
  async getSession(){try{return {data:{session:(await api('/api/auth/session')).session},error:null}}catch(e){return {data:{session:null},error:{message:e.message}}}},
  async signInWithPassword(params){
   try{return {data:await api('/api/auth/login',params),error:null}}
   catch(e){
    if(e.message!=='Correo o contraseña incorrectos')return {data:null,error:{message:e.message}};
    try{await api('/api/auth/migrate',params);}
    catch(migrationError){
     const invalid=['Credenciales incorrectas','Correo o contraseña incorrectos'];
     const message=invalid.includes(migrationError.message)?'Correo o contraseña incorrectos'
      :(migrationError.message==='El usuario no tiene acceso al panel'?migrationError.message
      :'No se pudo activar tu acceso a Cloudflare. Probá de nuevo. Si continúa, contactá con administración.');
     return {data:null,error:{message}};
    }
    try{return {data:await api('/api/auth/login',params),error:null}}
    catch(secondError){return {data:null,error:{message:secondError.message}}}
   }
  },
  async signOut(){try{await api('/api/auth/logout',{});return {error:null}}catch(e){return {error:{message:e.message}}}},
  async resetPasswordForEmail(){return {error:{message:'La recuperación por email aún no está configurada en Cloudflare. Pedile a la administradora un enlace de activación nuevo.'}}},
  async updateUser({password}){try{return {data:await api('/api/auth/change-password',{password}),error:null}}catch(e){return {data:null,error:{message:e.message}}}},
  onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}
 };
 const storage={
  from(){return {
   async upload(path,file){try{const content=await compress(file);const data=await api('/api/media/upload',content);images.set(path,data.url);return {data,error:null}}catch(e){return {data:null,error:{message:e.message}}}},
   getPublicUrl(path){return {data:{publicUrl:images.get(path)||location.origin+'/media/'+path}}}
  }}
 };
 const functions={async invoke(name,{body}={}){try{
  const data=await api(name==='admin-create-user'?'/api/admin/create-user':'/api/admin/update-user',body||{});
  return {data,error:null};
 }catch(e){return {data:null,error:{message:e.message}}}}};
 window.SAU_CONFIG={supabaseUrl:location.origin,supabaseKey:'cloudflare'};
 window.supabase={createClient(){return {auth,storage,functions,from(table){return new Query(table)},async rpc(name,params){try{return {data:(await api('/api/rpc',{name,params})).data,error:null}}catch(e){return {data:null,error:{message:e.message}}}}}}};
})();
