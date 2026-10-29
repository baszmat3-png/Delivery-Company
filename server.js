// الخادم: دخول وصلاحيات + مزامنة + واجهة العميل/المندوب + اشعارات تلجرام (بدون مكتبات خارجية)
const http=require('http'),https=require('https'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,DB=process.env.DB_FILE||path.join(__dirname,'data.json'),PUB=path.join(__dirname,'public');
const STAFF=['مدير','محاسب','ادخال','مخزن','Call Center'];
// ---- واتساب: القوالب الافتراضية (المتغيرات بين { })
const WA_EV={
 new:{label:'طلب جديد (استلام الطلب)',on:0,text:'مرحباً {customer} 👋\nتم استلام طلبك رقم {order_no} من {client}.\n💰 المبلغ: {total} د.ع\n📍 {gov} - {area}\n🔎 تتبع طلبك: {track_link}\n\n{company}'},
 assigned:{label:'تسليم الطلب للمندوب',on:1,text:'مرحباً {customer} 📦\nتم تسليم طلبك رقم {order_no} إلى المندوب:\n👤 {rep_name}\n📞 {rep_phone}\n\n🛍 {goods} ({qty})\n📍 {gov} - {area}\n💰 المبلغ المطلوب: {total} د.ع\n🔎 تتبع طلبك: {track_link}\n\n{company}'},
 onway:{label:'الطلب في الطريق اليك (قيد التنفيذ)',on:1,text:'🚚 طلبك رقم {order_no} في الطريق اليك الآن!\n👤 المندوب: {rep_name}\n📞 {rep_phone}\n💰 المبلغ المطلوب: {total} د.ع\nيرجى تجهيز المبلغ والتواجد لاستلام الطلب.\n🔎 {track_link}\n\n{company}'},
 delivered:{label:'تم تسليم الطلب',on:1,text:'✅ تم تسليم طلبك رقم {order_no} بنجاح.\nشكراً لك {customer} على ثقتك بنا 🌹\n\n{company}'},
 postponed:{label:'تأجيل الطلب',on:0,text:'⏳ تم تأجيل طلبك رقم {order_no}.\nسيتم التواصل معك قريباً لتحديد موعد جديد.\n🔎 {track_link}\n\n{company}'},
 returned:{label:'ارجاع الطلب',on:0,text:'↩️ تم ارجاع طلبك رقم {order_no}.\nللاستفسار تواصل معنا.\n\n{company}'}};
const waDef=()=>({on:0,provider:'ultramsg',instance:'',token:'',phoneId:'',url:'',method:'POST',headers:'',bodyTpl:'',base:'',auto:'',trackPhone:1,events:{}});
let db={state:null,auth:{},tg:{token:'',chat:'',on:1},secret:'',wa:null,waLog:[],waSent:{}};
try{const f=JSON.parse(fs.readFileSync(DB,'utf8'));Object.assign(db,f);db.tg=Object.assign({token:'',chat:'',on:1},f.tg||{})}catch(e){}
db.wa=Object.assign(waDef(),db.wa||{});db.waLog=db.waLog||[];db.waSent=db.waSent||{};
Object.keys(WA_EV).forEach(k=>db.wa.events[k]=Object.assign({on:WA_EV[k].on,text:WA_EV[k].text},db.wa.events[k]||{}));
const hash=(p,s=crypto.randomBytes(16).toString('hex'))=>s+':'+crypto.scryptSync(String(p),s,32).toString('hex');
const chk=(p,h)=>{if(!h)return false;const[s,x]=h.split(':'),y=crypto.scryptSync(String(p),s,32).toString('hex');return x.length==y.length&&crypto.timingSafeEqual(Buffer.from(x),Buffer.from(y))};
if(!db.secret)db.secret=process.env.SECRET||crypto.randomBytes(32).toString('hex');
if(process.env.ADMIN_PASS)db.auth.admin=hash(process.env.ADMIN_PASS);else if(!db.auth.admin){db.auth.admin=hash('admin123');console.log('⚠ كلمة مرور المدير الافتراضية admin123 — غيّرها فورا (ADMIN_PASS)')}
if(process.env.TELEGRAM_BOT_TOKEN)db.tg.token=process.env.TELEGRAM_BOT_TOKEN;
if(process.env.TELEGRAM_CHAT_ID)db.tg.chat=process.env.TELEGRAM_CHAT_ID;
let ft;const flush=()=>{clearTimeout(ft);ft=setTimeout(()=>{try{fs.writeFileSync(DB,JSON.stringify(db))}catch(e){console.error('save',e.message)}},300)};flush();
const touch=()=>{db.state.ts=Date.now();flush()};
// ---- تلجرام
function tg(method,body,token=db.tg.token){return new Promise(res=>{const d=JSON.stringify(body||{});
 const r=https.request({host:'api.telegram.org',path:`/bot${token}/${method}`,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(d)}},x=>{let b='';x.on('data',c=>b+=c);x.on('end',()=>{try{res(JSON.parse(b))}catch(e){res({ok:false,description:'رد غير صالح من تلجرام'})}})});
 r.on('error',e=>res({ok:false,description:e.message}));r.setTimeout(10000,()=>r.destroy(new Error('انتهت المهلة')));r.end(d)})}
const canSend=()=>db.tg.token&&db.tg.chat&&+db.tg.on;
const send=text=>canSend()?tg('sendMessage',{chat_id:db.tg.chat,text:String(text).slice(0,3500),disable_web_page_preview:true}):Promise.resolve({ok:false,description:'تلجرام غير مربوط أو متوقف'});
const queue=[];let busy=0;async function pump(){if(busy)return;busy=1;while(queue.length){const r=await send(queue.shift());if(!r.ok)console.log('tg:',r.description);await new Promise(r=>setTimeout(r,350))}busy=0}
const notify=t=>{queue.push(t);pump()};
// ---- واتساب (ارسال رسائل للزبائن عبر مزوّد API)
const phn=p=>{p=String(p||'').replace(/\D/g,'').replace(/^00/,'');if(p.length<7)return '';return p.startsWith('964')?p:p.replace(/^0/,'964')};
function httpReq(url,o={}){return new Promise(res=>{let u;try{u=new URL(url)}catch(e){return res({ok:false,description:'رابط API غير صالح'})}
 if(!/^https?:$/.test(u.protocol))return res({ok:false,description:'رابط API غير صالح'});
 const body=o.body||'',r=(u.protocol=='http:'?http:https).request(u,{method:o.method||'POST',headers:Object.assign(body?{'Content-Length':Buffer.byteLength(body)}:{},o.headers||{})},x=>{let b='';x.on('data',c=>{if(b.length<4000)b+=c});x.on('end',()=>res({ok:x.statusCode>=200&&x.statusCode<300,status:x.statusCode,body:b}))});
 r.on('error',e=>res({ok:false,description:e.message}));r.setTimeout(15000,()=>r.destroy(new Error('انتهت المهلة')));r.end(body)})}
async function waSend(phone,text){const c=db.wa,to=phn(phone);if(!to)return{ok:false,description:'رقم الهاتف غير صالح'};let r;
 const miss=d=>({ok:false,description:'اعدادات واتساب ناقصة: '+d});
 if(c.provider=='ultramsg'){if(!c.instance||!c.token)return miss('Instance ID و Token');
  r=await httpReq(`https://api.ultramsg.com/${encodeURIComponent(c.instance)}/messages/chat`,{headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:c.token,to:'+'+to,body:text}).toString()})}
 else if(c.provider=='whapi'){if(!c.token)return miss('Token');
  r=await httpReq('https://gate.whapi.cloud/messages/text',{headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.token,Accept:'application/json'},body:JSON.stringify({to,body:text})})}
 else if(c.provider=='meta'){if(!c.phoneId||!c.token)return miss('Phone Number ID و Token');
  r=await httpReq(`https://graph.facebook.com/v20.0/${encodeURIComponent(c.phoneId)}/messages`,{headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.token},body:JSON.stringify({messaging_product:'whatsapp',to,type:'text',text:{body:text,preview_url:true}})})}
 else{if(!c.url)return miss('رابط API');let h={};try{if(c.headers)h=JSON.parse(c.headers)}catch(e){return{ok:false,description:'Headers ليست JSON صالحة'}}
  const m=(c.method||'POST').toUpperCase(),js=s=>JSON.stringify(s).slice(1,-1),sub=(t,f)=>String(t).replace(/\{\{phone\}\}/g,f(to)).replace(/\{\{message\}\}/g,f(text));
  const url=sub(c.url,encodeURIComponent);let body='';
  if(m!='GET'){body=sub(c.bodyTpl||'{"phone":"{{phone}}","message":"{{message}}"}',js);if(!Object.keys(h).some(k=>k.toLowerCase()=='content-type'))h['Content-Type']=/^\s*[{[]/.test(body)?'application/json':'application/x-www-form-urlencoded'}
  r=await httpReq(url,{method:m,headers:h,body})}
 if(!r.ok)return{ok:false,description:r.description||('HTTP '+r.status+' '+String(r.body||'').slice(0,160))};
 try{const j=JSON.parse(r.body);if(j&&(j.error||j.sent===false||j.sent==='false'))return{ok:false,description:String(JSON.stringify(j.error||j)).slice(0,200)}}catch(e){}
 return{ok:true}}
const waQ=[];let waBusy=0;
async function waPump(){if(waBusy)return;waBusy=1;while(waQ.length){const j=waQ.shift(),r=await waSend(j.to,j.text).catch(e=>({ok:false,description:e.message}));
  db.waLog.unshift({t:Date.now(),no:j.no,ev:j.ev,to:j.to,ok:!!r.ok,err:r.ok?'':(r.description||'خطأ')});db.waLog.length=Math.min(db.waLog.length,200);flush();if(!r.ok)console.log('wa:',r.description);await new Promise(r=>setTimeout(r,1200))}waBusy=0}
const waBase=()=>(db.wa.base||process.env.RENDER_EXTERNAL_URL||db.wa.auto||'http://localhost:'+PORT).replace(/\/+$/,'');
const trackLink=o=>waBase()+'/track.html?no='+encodeURIComponent(o.no)+(+db.wa.trackPhone?'&p='+String(o.phone||'').replace(/\D/g,'').slice(-4):'');
function waVars(o){const S=db.state||{},rep=users().find(u=>u.id==o.rep)||{},cl=users().find(u=>u.id==o.client)||{};
 return{company:(S.co||{}).name||'',order_no:o.no,customer:o.cust,client:cl.name||'',rep_name:rep.name||'—',rep_phone:rep.phone||'—',gov:o.gov||'',area:o.area||'',goods:o.goods||'',qty:o.qty||1,total:(+o.total||0).toLocaleString('en-US'),status:ST[o.status]||'',date:o.date||'',track_link:trackLink(o)}}
const waFill=(t,v)=>String(t).replace(/\{(\w+)\}/g,(m,k)=>v[k]!=null?v[k]:m);
// ev: new | assigned | onway | delivered | postponed | returned — يُرسل مرة واحدة فقط لكل طلب وحدث
function waTrigger(o,ev){const c=db.wa,e=c.events[ev];if(!+c.on||!e||!+e.on||o.deleted||!phn(o.phone))return;
 const k=o.id+':'+ev+(ev=='assigned'?':'+o.rep:'');if(db.waSent[k])return;db.waSent[k]=Date.now();
 const ks=Object.keys(db.waSent);if(ks.length>30000)ks.slice(0,5000).forEach(x=>delete db.waSent[x]);
 waQ.push({to:o.phone,text:waFill(e.text,waVars(o)),no:o.no,ev});flush();waPump()}
const EV_ST=['','onway','delivered','postponed','returned'];
const hist=(o,s)=>{o.hist=(o.hist||[]).concat([{s,t:Date.now()}]).slice(-20)};
function waStatus(o,s){hist(o,s);if(EV_ST[s])waTrigger(o,EV_ST[s])}
// ---- جلسات (توكن موقّع، 30 يوم)
const sig=b=>crypto.createHmac('sha256',db.secret).update(b).digest('base64url');
const sign=o=>{const b=Buffer.from(JSON.stringify(o)).toString('base64url');return b+'.'+sig(b)};
const verify=t=>{try{const[b,s]=String(t).split('.');if(!s||s!==sig(b))return null;const o=JSON.parse(Buffer.from(b,'base64url'));return o.exp>Date.now()?o:null}catch(e){return null}};
const users=()=>(db.state&&db.state.users)||[];
const boot={id:1,name:'المدير العام',user:'admin',type:'مدير',active:1};
const find=id=>users().find(u=>u.id==id)||(!users().length&&id==1?boot:null);
const esc=(x,n=120)=>String(x==null?'':x).slice(0,n).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const td=()=>new Date().toISOString().slice(0,10),ST=['قيد الانتظار','قيد التنفيذ','تم التسليم','مؤجل','راجع'];
const tries={},trk={};
const MIME={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const body=req=>new Promise((ok,no)=>{let b='';req.on('data',c=>{b+=c;if(b.length>8e6){no('too big');req.destroy()}});req.on('end',()=>{try{ok(b?JSON.parse(b):{})}catch(e){no('bad json')}})});
const out=(res,c,o)=>{res.writeHead(c,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
const mask=t=>t?t.slice(0,6)+'••••••'+t.slice(-4):'';
function api(req,res,a,qs){return body(req).then(async b=>{const m=req.method;
 if(a=='health')return out(res,200,{ok:true});
 if(a=='login'&&m=='POST'){const ip=req.socket.remoteAddress,t=tries[ip]=(tries[ip]||[]).filter(x=>x>Date.now()-3e5);
  if(t.length>=10)return out(res,429,{error:'محاولات كثيرة، انتظر 5 دقائق'});
  const u=users().find(x=>x.user==b.user)||(!users().length&&b.user=='admin'?boot:null);
  if(!u||!+u.active||!chk(b.pass,db.auth[u.user])){t.push(Date.now());return out(res,401,{error:'بيانات الدخول غير صحيحة'})}
  return out(res,200,{token:sign({id:u.id,exp:Date.now()+30*864e5}),me:{id:u.id,name:u.name,user:u.user,type:u.type}})}
 if(a=='track'&&m=='GET'){const ip=req.socket.remoteAddress,t=trk[ip]=(trk[ip]||[]).filter(x=>x>Date.now()-3e5),co=((db.state||{}).co||{}).name||'';
  const no=String(qs.get('no')||'').trim().slice(0,30),p4=String(qs.get('p')||'').replace(/\D/g,'').slice(-4),need=!!+db.wa.trackPhone;
  if(!no)return out(res,200,{co,phone:need});
  if(t.length>=40)return out(res,429,{error:'محاولات كثيرة، انتظر 5 دقائق'});t.push(Date.now());
  if(need&&p4.length<4)return out(res,200,{co,phone:true,need:true});
  const L=((db.state||{}).orders||[]).filter(o=>!o.deleted&&String(o.no)==no&&(!need||String(o.phone||'').replace(/\D/g,'').slice(-4)==p4));
  const o=L[L.length-1];if(!o)return out(res,404,{error:'لم يتم العثور على طلب بهذه البيانات'});
  const rep=users().find(u=>u.id==o.rep);
  return out(res,200,{ok:true,co,no:o.no,date:o.date,status:o.status,gov:o.gov,area:o.area,cust:String(o.cust||'').split(' ')[0],rep:rep?{name:rep.name,phone:rep.phone||''}:null,hist:(o.hist||[]).map(h=>({s:h.s,t:h.t}))})}
 const tk=verify(req.headers['x-token']),me=tk&&find(tk.id);if(!me||!+me.active)return out(res,401,{error:'unauthorized'});
 const staff=STAFF.includes(me.type),mgr=me.type=='مدير';
 if(a=='state'&&m=='GET')return staff?out(res,200,{state:db.state}):out(res,403,{error:'forbidden'});
 if(a=='state'&&m=='PUT'){if(!staff)return out(res,403,{error:'forbidden'});const s=b;if(!s||!s.seq||!Array.isArray(s.orders)||!Array.isArray(s.users))return out(res,400,{error:'bad state'});
  const reset=mgr&&s.reset;delete s.reset;const old=db.state;if(old&&!reset){if(!mgr){s.users=old.users;s.co=old.co;s.prov=old.prov}
   const ids=new Set(s.orders.map(o=>o.id));old.orders.forEach(o=>{if(!ids.has(o.id))s.orders.push(o)});s.seq=Math.max(s.seq,old.seq||0)}
  s.users.forEach(u=>{if(u.pass){if(!db.auth[u.user])db.auth[u.user]=hash(u.pass);delete u.pass}});
  Object.keys(db.auth).forEach(k=>{if(k!='admin'&&!s.users.some(u=>u.user==k))delete db.auth[k]});
  db.state=s;
  if(old&&!reset){const om=new Map(old.orders.map(o=>[o.id,o]));s.orders.forEach(o=>{const p=om.get(o.id);
    if(!p){if(!Array.isArray(o.hist))hist(o,+o.status||0);waTrigger(o,'new');if(+o.rep)waTrigger(o,'assigned');if(EV_ST[o.status])waTrigger(o,EV_ST[o.status]);return}
    if(!o.hist&&p.hist)o.hist=p.hist;
    if(+p.rep!=+o.rep&&+o.rep)waTrigger(o,'assigned');
    if(+p.status!=+o.status)waStatus(o,+o.status)})}
  touch();return out(res,200,{ok:true})}
 if(a=='portal'&&m=='GET'){const S=db.state||{orders:[],prov:{},co:{}},cl=me.type=='عميل',P=o=>S.prov[o.gov]||[0,0];
  const ord=S.orders.filter(o=>!o.deleted&&(cl?o.client==me.id:o.rep==me.id)).slice(-300).reverse().map(o=>({id:o.id,no:o.no,date:o.date,cust:o.cust,phone:o.phone,gov:o.gov,area:o.area,goods:o.goods,qty:o.qty,total:o.total,notes:o.notes,status:o.status,fee:(cl?P(o)[0]+(+o.xc||0):P(o)[1]+(+o.xr||0))}));
  return out(res,200,{me:{id:me.id,name:me.name,type:me.type,phone:me.phone},co:(S.co||{}).name||'',govs:Object.keys(S.prov||{}),orders:ord})}
 if(a=='order'&&m=='POST'){if(me.type!='عميل'||!db.state)return out(res,403,{error:'غير مسموح'});const S=db.state;
  const o={id:Date.now(),no:esc(b.no,30).trim(),date:td(),client:me.id,rep:0,gov:S.prov[b.gov]?b.gov:(S.co||{}).gov,area:esc(b.area),cust:esc(b.cust).trim(),phone:esc(b.phone,20),goods:esc(b.goods),qty:Math.max(1,+b.qty||1),total:+b.total||0,xc:0,xr:0,notes:esc(b.notes,300),status:0,archived:false,deleted:false};
  if(!o.no||!o.cust||o.total<=0)return out(res,400,{error:'ادخل رقم الوصل واسم الزبون والمبلغ'});
  if(S.orders.some(x=>x.no==o.no&&x.client==me.id))return out(res,400,{error:'رقم الوصل مكرر'});
  hist(o,0);S.orders.push(o);waTrigger(o,'new');const t=`🆕 طلب جديد ${o.no} من العميل ${me.name} — ${o.cust} — ${o.gov} — ${(+o.total).toLocaleString('en-US')} د.ع`;S.notes.unshift({d:td(),t});touch();notify('🔔 '+(S.co||{}).name+'\n'+t);return out(res,200,{ok:true})}
 if(a=='ostatus'&&m=='POST'){const o=db.state&&db.state.orders.find(x=>x.id==b.id),s=+b.status;if(!o||!(s>=0&&s<=4))return out(res,400,{error:'طلب غير صالح'});
  if(!staff&&!(me.type=='مندوب'&&o.rep==me.id&&s>0))return out(res,403,{error:'غير مسموح'});
  const prev=o.status;o.status=s;if(prev!=s)waStatus(o,s);const t=`🔄 الوصل ${o.no} : ${ST[s]} (${me.name})`;db.state.notes.unshift({d:td(),t});touch();notify('🔔 '+(db.state.co||{}).name+'\n'+t);return out(res,200,{ok:true})}
 if(a=='passwd'&&m=='POST'){const p=String(b.pass||'');if(p.length<6)return out(res,400,{error:'كلمة المرور 6 احرف على الاقل'});
  const target=b.user&&b.user!=me.user?b.user:me.user;
  if(target!=me.user){if(!mgr)return out(res,403,{error:'غير مسموح'})}else if(!chk(b.old,db.auth[me.user]))return out(res,400,{error:'كلمة المرور الحالية خاطئة'});
  if(target!='admin'&&!users().some(u=>u.user==target))return out(res,404,{error:'مستخدم غير موجود'});
  db.auth[target]=hash(p);flush();return out(res,200,{ok:true})}
 if(a=='notify'&&m=='POST'){if(!staff)return out(res,403,{error:'forbidden'});if(b.text)notify(b.text);return out(res,200,{ok:true,queued:!!canSend()})}
 if(a.startsWith('wa')){if(!mgr)return out(res,403,{error:'للمدير فقط'});const c=db.wa;
  if(req.headers.host)c.auto=(req.headers['x-forwarded-proto']||'http').split(',')[0]+'://'+req.headers.host;
  if(a=='wa'&&m=='GET')return out(res,200,{on:+c.on,provider:c.provider,instance:c.instance,phoneId:c.phoneId,url:c.url,method:c.method,headers:c.headers,bodyTpl:c.bodyTpl,base:c.base,trackPhone:+c.trackPhone,set:!!c.token,mask:mask(c.token),events:Object.fromEntries(Object.keys(WA_EV).map(k=>[k,{label:WA_EV[k].label,on:+c.events[k].on,text:c.events[k].text}])),eff:waBase(),log:db.waLog.slice(0,60),queue:waQ.length});
  if(a=='wa'&&m=='POST'){const S=(k,n)=>{if(b[k]!=null)c[k]=String(b[k]).trim().slice(0,n||300)};
   if(b.on!=null)c.on=+b.on?1:0;if(b.trackPhone!=null)c.trackPhone=+b.trackPhone?1:0;
   if(['ultramsg','whapi','meta','custom'].includes(b.provider))c.provider=b.provider;
   ['instance','phoneId','url','base'].forEach(k=>S(k));S('method',6);S('headers',1500);S('bodyTpl',1500);if(b.token)c.token=String(b.token).trim().slice(0,500);
   if(b.events&&typeof b.events=='object')Object.keys(WA_EV).forEach(k=>{const e=b.events[k];if(e){if(e.on!=null)c.events[k].on=+e.on?1:0;if(e.text!=null&&String(e.text).trim())c.events[k].text=String(e.text).slice(0,1500)}});
   flush();return out(res,200,{ok:true})}
  if(a=='wa-test'&&m=='POST'){const r=await waSend(b.phone,String(b.text||'✅ رسالة تجريبية من لوحة التحكم — ربط واتساب يعمل بنجاح').slice(0,1500));
   db.waLog.unshift({t:Date.now(),no:'—',ev:'test',to:String(b.phone||''),ok:!!r.ok,err:r.ok?'':(r.description||'خطأ')});flush();return out(res,200,r)}
  if(a=='wa-clear'&&m=='POST'){db.waLog=[];flush();return out(res,200,{ok:true})}}
 if(a.startsWith('tg')){if(!mgr)return out(res,403,{error:'للمدير فقط'});
  if(a=='tg'&&m=='GET')return out(res,200,{set:!!db.tg.token,mask:mask(db.tg.token),chat:db.tg.chat,on:+db.tg.on});
  if(a=='tg'&&m=='POST'){if(b.token)db.tg.token=String(b.token).trim();if(b.chat!=null)db.tg.chat=String(b.chat).trim();if(b.on!=null)db.tg.on=+b.on;flush();return out(res,200,{ok:true})}
  if(a=='tg-test')return out(res,200,await send('✅ تم ربط اشعارات تلجرام بنجاح بلوحة التحكم'));
  if(a=='tg-find'){const t=(b.token||db.tg.token||'').trim();if(!t)return out(res,200,{ok:false,description:'ادخل التوكن اولا'});
   const r=await tg('getUpdates',{limit:30},t);if(!r.ok)return out(res,200,r);
   const c=r.result.map(x=>(x.message||x.channel_post||(x.my_chat_member||{})).chat).filter(Boolean).pop();
   return out(res,200,c?{ok:true,chat:String(c.id),name:c.title||c.first_name||''}:{ok:false,description:'لا توجد رسائل — ارسل أي رسالة للبوت ثم أعد المحاولة'})}}
 return out(res,404,{error:'not found'})}).catch(e=>out(res,400,{error:String(e)}))}
http.createServer((req,res)=>{const p=new URL(req.url,'http://x').pathname;
 if(p.startsWith('/api/'))return api(req,res,p.slice(5),new URL(req.url,'http://x').searchParams);
 let f=path.normalize(path.join(PUB,p==='/'?'index.html':p));if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(PUB,'index.html');
 res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)
}).listen(PORT,()=>console.log('http://localhost:'+PORT));
