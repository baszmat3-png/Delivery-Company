/* مولّد QR صغير (بايت UTF-8، تصحيح M، النسخ 1–10) — بدون مكتبات خارجية */
(function(){
const ECC=[10,16,26,18,24,16,18,22,22,26],BLK=[1,1,1,2,2,4,4,4,5,5],TOT=[26,44,70,100,134,172,196,242,292,346],
 ALN=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
const EXP=new Array(512),LOG=new Array(256);
(function(){let x=1;for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11d}for(let i=255;i<512;i++)EXP[i]=EXP[i-255]})();
const mul=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
function rsGen(d){let g=[1];for(let i=0;i<d;i++){const nx=new Array(g.length+1).fill(0);for(let j=0;j<g.length;j++){nx[j]^=g[j];nx[j+1]^=mul(g[j],EXP[i])}g=nx}return g}
function rsRem(data,d){const g=rsGen(d),r=new Array(d).fill(0);for(const b of data){const f=b^r.shift();r.push(0);for(let i=0;i<d;i++)r[i]^=mul(g[i+1],f)}return r}
const utf8=s=>Array.from(unescape(encodeURIComponent(s))).map(c=>c.charCodeAt(0));
function build(text){
 const bytes=utf8(text);let v=0;
 for(let i=0;i<10;i++){const dc=TOT[i]-ECC[i]*BLK[i];if(4+(i<9?8:16)+8*bytes.length<=8*dc){v=i+1;break}}
 if(!v)throw new Error('النص طويل');
 const dc=TOT[v-1]-ECC[v-1]*BLK[v-1],bits=[],put=(x,n)=>{for(let i=n-1;i>=0;i--)bits.push((x>>>i)&1)};
 put(4,4);put(bytes.length,v<10?8:16);bytes.forEach(b=>put(b,8));
 for(let i=0;i<4&&bits.length<dc*8;i++)bits.push(0);while(bits.length%8)bits.push(0);
 const cw=[];for(let i=0;i<bits.length;i+=8){let x=0;for(let j=0;j<8;j++)x=x<<1|bits[i+j];cw.push(x)}
 for(let p=0;cw.length<dc;p++)cw.push(p%2?0x11:0xEC);
 const nb=BLK[v-1],ec=ECC[v-1],short=nb-dc%nb,sl=Math.floor(dc/nb),blocks=[],eccs=[];let k=0;
 for(let i=0;i<nb;i++){const len=sl+(i<short?0:1),d=cw.slice(k,k+len);k+=len;blocks.push(d);eccs.push(rsRem(d,ec))}
 const all=[];for(let i=0;i<=sl;i++)blocks.forEach(b=>{if(i<b.length)all.push(b[i])});
 for(let i=0;i<ec;i++)eccs.forEach(e=>all.push(e[i]));
 const size=17+4*v,M=[],F=[];for(let i=0;i<size;i++){M.push(new Array(size).fill(false));F.push(new Array(size).fill(false))}
 const setF=(x,y,d)=>{if(x>=0&&x<size&&y>=0&&y<size){M[y][x]=!!d;F[y][x]=true}},gb=(x,i)=>((x>>>i)&1)!=0;
 for(let i=0;i<size;i++){setF(6,i,i%2==0);setF(i,6,i%2==0)}
 [[3,3],[size-4,3],[3,size-4]].forEach(([x,y])=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy));setF(x+dx,y+dy,d!=2&&d!=4)}});
 const ap=ALN[v-1],n=ap.length;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){if((i==0&&j==0)||(i==0&&j==n-1)||(i==n-1&&j==0))continue;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)setF(ap[i]+dx,ap[j]+dy,Math.max(Math.abs(dx),Math.abs(dy))!=1)}
 const fmt=mask=>{const d=mask;let r=d;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);const b=((d<<10)|r)^0x5412;
  for(let i=0;i<=5;i++)setF(8,i,gb(b,i));setF(8,7,gb(b,6));setF(8,8,gb(b,7));setF(7,8,gb(b,8));for(let i=9;i<15;i++)setF(14-i,8,gb(b,i));
  for(let i=0;i<8;i++)setF(size-1-i,8,gb(b,i));for(let i=8;i<15;i++)setF(8,size-15+i,gb(b,i));setF(8,size-8,true)};
 fmt(0);
 if(v>=7){let r=v;for(let i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1F25);const b=(v<<12)|r;for(let i=0;i<18;i++){const a=size-11+i%3,c=Math.floor(i/3);setF(a,c,gb(b,i));setF(c,a,gb(b,i))}}
 let bi=0;
 for(let right=size-1;right>=1;right-=2){if(right==6)right=5;
  for(let vert=0;vert<size;vert++)for(let j=0;j<2;j++){const x=right-j,up=((right+1)&2)==0,y=up?size-1-vert:vert;
   if(!F[y][x]&&bi<all.length*8){M[y][x]=gb(all[bi>>3],7-(bi&7));bi++}}}
 const cond=[(x,y)=>(x+y)%2==0,(x,y)=>y%2==0,(x,y)=>x%3==0,(x,y)=>(x+y)%3==0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2==0,(x,y)=>x*y%2+x*y%3==0,(x,y)=>(x*y%2+x*y%3)%2==0,(x,y)=>((x+y)%2+x*y%3)%2==0];
 const apply=m=>{for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!F[y][x]&&cond[m](x,y))M[y][x]=!M[y][x]};
 const pen=()=>{let p=0;
  for(let t=0;t<2;t++){for(let a=0;a<size;a++){let run=1,prev=null;for(let b=0;b<size;b++){const c=t?M[b][a]:M[a][b];if(c===prev){run++;if(run==5)p+=3;else if(run>5)p++}else{run=1;prev=c}}}}
  for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const c=M[y][x];if(c==M[y][x+1]&&c==M[y+1][x]&&c==M[y+1][x+1])p+=3}
  const pat=[true,false,true,true,true,false,true,false,false,false,false],rv=pat.slice().reverse();
  for(let t=0;t<2;t++)for(let a=0;a<size;a++)for(let b=0;b<=size-11;b++){let m1=true,m2=true;for(let i=0;i<11;i++){const c=t?M[b+i][a]:M[a][b+i];if(c!==pat[i])m1=false;if(c!==rv[i])m2=false}if(m1)p+=40;if(m2)p+=40}
  let dark=0;for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(M[y][x])dark++;p+=Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10;return p};
 let best=0,bp=1e9;for(let m=0;m<8;m++){apply(m);fmt(m);const p=pen();if(p<bp){bp=p;best=m}apply(m)}
 apply(best);fmt(best);return M}
/* يعيد وسم SVG بعرض mm محدد */
window.qrSvg=function(text,mm){const M=build(text),s=M.length,q=2;let d='';
 for(let y=0;y<s;y++){let x=0;while(x<s){if(M[y][x]){let e=x;while(e<s&&M[y][e])e++;d+=`M${x+q} ${y+q}h${e-x}v1h-${e-x}z`;x=e}else x++}}
 const w=s+q*2;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${w}" width="${mm||34}mm" height="${mm||34}mm" shape-rendering="crispEdges"><rect width="${w}" height="${w}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`};
window.qrMatrix=build;
})();
