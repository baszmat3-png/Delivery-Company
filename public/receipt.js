/* وصل الطلب وسند القبض/الصرف — معاينة وطباعة (58mm أو 85mm) + اعدادات الطابعة + باركود QR */
(function(){
const n=x=>(+x||0).toLocaleString('en-US');
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ones=['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'],
 tens=['','','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'],
 hund=['','مائة','مائتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة'];
function b1000(x){const a=[],h=Math.floor(x/100),r=x%100;if(h)a.push(hund[h]);if(r){if(r<20)a.push(ones[r]);else{const o=r%10,t=Math.floor(r/10);a.push(o?ones[o]+' و'+tens[t]:tens[t])}}return a.join(' و')}
function scale(x,one,two,few,many){if(!x)return'';if(x==1)return one;if(x==2)return two;const w=b1000(x);return w+' '+(x<=10?few:many)}
window.tafqeet=function(v){v=Math.floor(Math.abs(+v||0));if(!v)return'صفر دينار عراقي فقط لا غير';
 const bil=Math.floor(v/1e9),mil=Math.floor(v%1e9/1e6),th=Math.floor(v%1e6/1e3),r=v%1e3,p=[];
 if(bil)p.push(scale(bil,'مليار','ملياران','مليارات','مليار'));if(mil)p.push(scale(mil,'مليون','مليونان','ملايين','مليون'));
 if(th)p.push(scale(th,'ألف','ألفان','آلاف','ألف'));if(r)p.push(b1000(r));
 return p.join(' و')+' دينار عراقي فقط لا غير'};

/* ===== اعدادات الطابعة (تُحفظ على هذا الجهاز) ===== */
const DEF={paper:85,font:'normal',copies:1,logo:1,qr:1,head:'',foot:'شكراً لتعاملكم معنا'};
window.getPS=function(){let s={};try{s=JSON.parse(localStorage.ufq_print||'{}')}catch(e){}const o=Object.assign({},DEF,s);o.paper=+o.paper==58?58:85;o.copies=Math.min(5,Math.max(1,+o.copies||1));return o};
const setPS=o=>{try{localStorage.ufq_print=JSON.stringify(o)}catch(e){}};

const css=ps=>{const W=ps.paper,sm=W==58,fs={small:10.5,normal:12,large:14}[ps.font]-(sm?1:0);
 return `@page{size:${W}mm auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}
body{width:${W}mm;padding:${sm?'2mm 2mm 5mm':'4mm 4mm 6mm'};font-family:Cairo,Tahoma,Arial,sans-serif;font-size:${fs}px;color:#000;direction:rtl;line-height:1.5}
.c{text-align:center}.logo{width:${sm?44:56}px;height:${sm?44:56}px;object-fit:contain;filter:grayscale(1) contrast(1.3)}
h1{font-size:${fs+3}px;margin:2px 0 0}h2{font-size:${fs+1}px;margin:6px 0;padding:3px 0;border:1.5px solid #000;border-radius:6px;text-align:center}
.dv{border-top:1px dashed #000;margin:6px 0}.r{display:flex;justify-content:space-between;gap:6px;padding:1.5px 0}
.r span:first-child{font-weight:700;white-space:nowrap}.r span:last-child{text-align:left;word-break:break-word}
.tot{border:2px solid #000;border-radius:8px;padding:5px 8px;margin:6px 0;display:flex;justify-content:space-between;align-items:center;font-weight:800}
.tot b{font-size:${fs+6}px}.sm{font-size:${fs-1.5}px}.words{font-size:${fs-1}px;font-weight:700;margin:4px 0;text-align:center}
.sig{display:flex;justify-content:space-between;margin-top:18px;font-size:${fs-1}px}.sig div{width:44%;text-align:center;border-top:1px solid #000;padding-top:3px}
.no{font-size:${fs+4}px;font-weight:800;text-align:center;margin:2px 0}.qr{text-align:center;margin:4px 0}.qr svg{display:inline-block}`};
const head=(r,title,ps)=>`<div class="c">${ps.logo?`<img class="logo" src="${esc(r.logo||(location.protocol.startsWith('http')?location.origin+'/logo.png':'logo.png'))}" alt="">`:''}<h1>${esc(r.co||'')}</h1>${ps.head?`<div class="sm">${esc(ps.head)}</div>`:''}</div><h2>${title}</h2>`;
const row=(l,v)=>(v===''||v==null)?'':`<div class="r"><span>${l}</span><span>${esc(v)}</span></div>`;
const now=()=>{const d=new Date(),p=x=>String(x).padStart(2,'0');return d.getFullYear()+'/'+p(d.getMonth()+1)+'/'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())};
const wrap=(b,ps)=>`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>طباعة</title><style>${css(ps)}</style></head><body>${Array(ps.copies).fill(b).join('<div style="page-break-after:always;break-after:page;height:1px"></div>')}</body></html>`;

/* وصل طلب */
window.receiptHTML=function(r,ps){ps=ps||getPS();
 let qr='';if(ps.qr&&r.link){try{qr=`<div class="qr">${qrSvg(r.link,ps.paper==58?32:40)}<div class="sm"><b>امسح الباركود لعرض كل تفاصيل الطلب</b></div></div>`}catch(e){qr=`<div class="c sm">${esc(r.link)}</div>`}}
 return wrap(head(r,'وصل توصيل',ps)+`<div class="no">#${esc(r.no)}</div>`+
 row('التاريخ',r.date)+row('الحالة',r.status)+row('العميل',r.client)+'<div class="dv"></div>'+
 row('الزبون',r.cust)+row('الهاتف',r.phone)+row('المحافظة',r.gov)+row('المنطقة',r.area)+'<div class="dv"></div>'+
 row('البضاعة',r.goods)+row('عدد القطع',r.qty)+(r.notes?row('ملاحظات',r.notes):'')+
 `<div class="tot"><span>المبلغ المطلوب</span><b>${n(r.total)} د.ع</b></div>`+
 (r.showFee?row('اجرة التوصيل',n(r.fee)+' د.ع')+row('الصافي للعميل',n((+r.total||0)-(+r.fee||0))+' د.ع'):'')+
 (r.rep?'<div class="dv"></div>'+row('المندوب',r.rep)+row('هاتف المندوب',r.repPhone):'')+
 (qr?'<div class="dv"></div>'+qr:'')+
 `<div class="dv"></div><div class="c sm">${esc(ps.foot)}<br>${now()}</div>`,ps)};

/* سند قبض / صرف */
window.voucherHTML=function(v,ps){ps=ps||getPS();const q=v.type=='قبض';
 return wrap(head(v,q?'سند قبض':'سند صرف',ps)+`<div class="no">${esc(v.no)}</div>`+
 row('التاريخ',v.date)+row(q?'استلمنا من':'صرفنا إلى',v.party)+row('طريقة الدفع',v.method)+row('المرجع',v.ref)+
 `<div class="tot"><span>المبلغ</span><b>${n(v.amt)} د.ع</b></div><div class="words">${tafqeet(v.amt)}</div>`+
 (v.note?'<div class="dv"></div>'+row('البيان',v.note):'')+row('المحاسب',v.by)+
 `<div class="sig"><div>${q?'المسلِّم':'المستلم'}</div><div>المحاسب</div></div><div class="dv"></div><div class="c sm">${now()}</div>`,ps)};

/* ===== نافذة المعاينة والطباعة (build = دالة تبني HTML حسب الاعدادات) ===== */
const BS='border:0;border-radius:12px;padding:12px;font:800 15px Cairo,Tahoma,sans-serif;cursor:pointer';
window.previewPrint=function(build,title){
 const old=document.getElementById('rcpt-ov');if(old)old.remove();
 const ov=document.createElement('div');ov.id='rcpt-ov';
 ov.style.cssText='position:fixed;inset:0;z-index:99999;background:#000b;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:12px;overflow:auto;font-family:Cairo,Tahoma,sans-serif';
 const ps0=getPS();
 ov.innerHTML=`<div style="background:#fff;border-radius:16px;padding:12px;max-width:100%;box-shadow:0 20px 60px #0008;direction:rtl"><div style="display:flex;gap:8px;margin-bottom:8px"><button id="rc-p" style="${BS};flex:1;background:#1e5aa8;color:#fff">🖨 طباعة</button><button id="rc-c" style="${BS};padding:12px 18px;background:#e5e7eb;color:#111">إغلاق</button></div>
 <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;font-size:13px;color:#444"><span>حجم الورق:</span><select id="rc-w" style="flex:1;padding:8px;border-radius:10px;border:1.5px solid #ccc;font:700 14px Cairo,Tahoma,sans-serif"><option value="85">85 mm</option><option value="58">58 mm</option></select><button id="rc-s" style="${BS};padding:8px 12px;background:#eef2ff;color:#1e5aa8;font-size:13px">⚙ الطابعة</button></div>
 <div style="text-align:center;font-size:12px;color:#666;margin-bottom:6px">${esc(title||'معاينة')}</div><div style="overflow:auto;max-width:100%"><iframe id="rc-f" style="width:${ps0.paper}mm;height:420px;border:1px dashed #bbb;background:#fff;display:block;margin:0 auto" srcdoc=""></iframe></div></div>`;
 document.body.appendChild(ov);
 const f=ov.querySelector('#rc-f'),sel=ov.querySelector('#rc-w');sel.value=String(ps0.paper);let html='';
 const draw=()=>{const ps=getPS();f.style.width=ps.paper+'mm';html=build(ps);f.srcdoc=html};
 f.onload=()=>{try{f.style.height=(f.contentDocument.documentElement.scrollHeight+8)+'px'}catch(e){}};
 sel.onchange=()=>{const ps=getPS();ps.paper=+sel.value;setPS(ps);draw()};
 ov.querySelector('#rc-s').onclick=()=>{ov.remove();showPrinterSettings(()=>previewPrint(build,title))};
 ov.querySelector('#rc-c').onclick=()=>ov.remove();
 ov.addEventListener('click',e=>{if(e.target===ov)ov.remove()});
 ov.querySelector('#rc-p').onclick=()=>{const ps=getPS();
  if(window.AndroidPrint&&AndroidPrint.printHtml){AndroidPrint.printHtml(html,ps.paper);return}
  try{f.contentWindow.focus();f.contentWindow.print()}catch(e){alert('تعذرت الطباعة من هذا المتصفح')}};
 draw();
};
window.printReceipt=r=>previewPrint(ps=>receiptHTML(r,ps),'وصل #'+r.no);
window.printVoucher=v=>previewPrint(ps=>voucherHTML(v,ps),(v.type=='قبض'?'سند قبض ':'سند صرف ')+v.no);

/* ===== نموذج اعدادات الطابعة (يُستخدم في اللوحة وفي نافذة منبثقة) ===== */
const FS='width:100%;border:1.5px solid #cfd6e4;border-radius:12px;padding:11px;font:700 14px Cairo,Tahoma,sans-serif;background:#fff;color:#111;direction:rtl';
const LB='display:block;margin:12px 2px 5px;font-size:13px;font-weight:700;color:#556';
window.printerFormHTML=function(){const p=getPS();
 return `<div class="psf" style="direction:rtl;text-align:right">
 <label style="${LB}">حجم الورق</label><select id="ps_paper" style="${FS}"><option value="85" ${p.paper==85?'selected':''}>85 mm (طابعة حرارية كبيرة)</option><option value="58" ${p.paper==58?'selected':''}>58 mm (طابعة حرارية صغيرة)</option></select>
 <label style="${LB}">حجم الخط</label><select id="ps_font" style="${FS}"><option value="small" ${p.font=='small'?'selected':''}>صغير</option><option value="normal" ${p.font=='normal'?'selected':''}>متوسط</option><option value="large" ${p.font=='large'?'selected':''}>كبير</option></select>
 <label style="${LB}">عدد النسخ</label><input id="ps_copies" type="number" min="1" max="5" value="${p.copies}" style="${FS}">
 <label style="${LB}">سطر تحت اسم الشركة (هاتف / عنوان)</label><input id="ps_head" value="${esc(p.head)}" placeholder="مثال: 0770xxxxxxx — كربلاء" style="${FS}">
 <label style="${LB}">نص أسفل الوصل</label><input id="ps_foot" value="${esc(p.foot)}" style="${FS}">
 <label style="display:flex;gap:8px;align-items:center;margin:14px 2px 0;font-weight:700"><input id="ps_logo" type="checkbox" ${p.logo?'checked':''} style="width:20px;height:20px"> طباعة الشعار</label>
 <label style="display:flex;gap:8px;align-items:center;margin:10px 2px 0;font-weight:700"><input id="ps_qr" type="checkbox" ${p.qr?'checked':''} style="width:20px;height:20px"> طباعة باركود QR (يفتح تفاصيل الطلب)</label>
 <div style="margin-top:14px;padding:11px;border-radius:12px;background:#eef2ff;color:#1e3a6e;font-size:12.5px;line-height:1.8"><b>ربط الطابعة:</b><br>• عند الضغط على «طباعة» تظهر نافذة اختيار الطابعة من جهازك (USB / واي فاي / بلوتوث).<br>• أندرويد: ثبّت تطبيق/خدمة طابعتك (مثل خدمة الشركة المصنّعة أو RawBT) وأقرنها بالبلوتوث ثم اخترها من نافذة الطباعة.<br>• الكمبيوتر: ثبّت تعريف الطابعة واختر الحجم المناسب.<br>• الإعدادات محفوظة على هذا الجهاز فقط.</div></div>`};
window.savePS=function(){const g=i=>document.getElementById(i),o={paper:+g('ps_paper').value,font:g('ps_font').value,copies:+g('ps_copies').value||1,head:g('ps_head').value.trim(),foot:g('ps_foot').value.trim(),logo:g('ps_logo').checked?1:0,qr:g('ps_qr').checked?1:0};setPS(o);return o};
window.testPrint=function(co){savePS();printReceipt({co:co||'شركة التراث للتوصيل السريع',no:'1001',date:new Date().toISOString().slice(0,10),status:'قيد التنفيذ',client:'متجر تجريبي',cust:'اسم الزبون',phone:'07701234567',gov:'كربلاء',area:'حي الحسين',goods:'بضاعة تجريبية',qty:2,total:35000,notes:'طباعة تجريبية',showFee:false,rep:'اسم المندوب',repPhone:'07709876543',link:(location.protocol.startsWith('http')?location.origin:'https://example.com')+'/track.html?no=1001&p=4567'})};
window.showPrinterSettings=function(after,co){
 const old=document.getElementById('ps-ov');if(old)old.remove();
 const ov=document.createElement('div');ov.id='ps-ov';
 ov.style.cssText='position:fixed;inset:0;z-index:99998;background:#000b;display:flex;justify-content:center;align-items:flex-start;padding:12px;overflow:auto;font-family:Cairo,Tahoma,sans-serif';
 ov.innerHTML=`<div style="background:#fff;border-radius:16px;padding:14px;width:100%;max-width:440px;color:#111;direction:rtl"><h3 style="margin:0 0 6px;font-size:17px">🖨 اعدادات الطابعة</h3>${printerFormHTML()}<div style="display:flex;gap:8px;margin-top:14px"><button id="ps-s" style="${BS};flex:1;background:#1e5aa8;color:#fff">حفظ</button><button id="ps-t" style="${BS};background:#eef2ff;color:#1e5aa8">طباعة تجريبية</button><button id="ps-x" style="${BS};background:#e5e7eb;color:#111">إغلاق</button></div></div>`;
 document.body.appendChild(ov);
 ov.querySelector('#ps-s').onclick=()=>{savePS();ov.remove();if(after)after()};
 ov.querySelector('#ps-t').onclick=()=>{ov.remove();testPrint(co)};
 ov.querySelector('#ps-x').onclick=()=>{ov.remove();if(after)after()};
};
})();
