// Renders the Claude Clicker mascot pixel-art to branded PNG app icons.
// Pure Node (zlib only) — no external deps, no rasterizer needed.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const OUT = process.argv[2] || '.';

const MASCOT = [
  "...##....##...",
  "...##....##...",
  ".############.",
  "##############",
  "##EE######EE##",
  "##EE######EE##",
  "##############",
  "##############",
  "##############",
  ".############.",
  ".##.##..##.##.",
  ".##.##..##.##.",
];
const GW = MASCOT[0].length, GH = MASCOT.length;

const hex = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
const BODY = hex('#d97757'), EDGE = hex('#8a4530'), EYE = hex('#1a0e08');
const BG_TOP = hex('#2a1e16'), BG_BOT = hex('#120e0b'), GLOW = hex('#d97757');

function cellType(x, y) {
  const c = MASCOT[y][x];
  if (c === '.') return null;
  if (c === 'E') return 'eye';
  const l = x>0 ? MASCOT[y][x-1] : '.';
  const r = x<GW-1 ? MASCOT[y][x+1] : '.';
  const u = y>0 ? MASCOT[y-1][x] : '.';
  const d = y<GH-1 ? MASCOT[y+1][x] : '.';
  return (l==='.'||r==='.'||u==='.'||d==='.') ? 'edge' : 'body';
}

function makeIcon(W, H, frac, shiftY) {
  shiftY = shiftY || 0;
  const buf = Buffer.alloc(W*H*4);
  const set = (x,y,r,g,b,a) => {
    if (x<0||y<0||x>=W||y>=H) return;
    const i=(y*W+x)*4, sa=a/255;
    buf[i]=Math.round(r*sa+buf[i]*(1-sa));
    buf[i+1]=Math.round(g*sa+buf[i+1]*(1-sa));
    buf[i+2]=Math.round(b*sa+buf[i+2]*(1-sa));
    buf[i+3]=255;
  };
  // background: vertical gradient + soft radial accent glow
  const cx=W*0.5, cy=H*(0.40+shiftY), glowR=Math.max(W,H)*0.6;
  for (let y=0;y<H;y++){
    const t=y/(H-1);
    const br=BG_TOP[0]+(BG_BOT[0]-BG_TOP[0])*t;
    const bg=BG_TOP[1]+(BG_BOT[1]-BG_TOP[1])*t;
    const bb=BG_TOP[2]+(BG_BOT[2]-BG_TOP[2])*t;
    for (let x=0;x<W;x++){
      const dx=x-cx, dy=y-cy, d=Math.sqrt(dx*dx+dy*dy)/glowR, g=Math.max(0,1-d), gg=g*g*0.28;
      const i=(y*W+x)*4;
      buf[i]=Math.min(255,Math.round(br+(GLOW[0]-br)*gg));
      buf[i+1]=Math.min(255,Math.round(bg+(GLOW[1]-bg)*gg));
      buf[i+2]=Math.min(255,Math.round(bb+(GLOW[2]-bb)*gg));
      buf[i+3]=255;
    }
  }
  const cell=Math.floor(Math.min(W*frac/GW, H*frac/GH));
  const mW=cell*GW, mH=cell*GH;
  const ox=Math.round((W-mW)/2), oy=Math.round((H-mH)/2 + H*shiftY);
  // ground shadow ellipse
  const sCx=ox+mW/2, sCy=oy+mH*0.99, sRx=mW*0.44, sRy=Math.max(2,cell*1.3);
  for (let y=Math.floor(sCy-sRy);y<=Math.ceil(sCy+sRy);y++)
    for (let x=Math.floor(sCx-sRx);x<=Math.ceil(sCx+sRx);x++){
      const nx=(x-sCx)/sRx, ny=(y-sCy)/sRy, dd=nx*nx+ny*ny;
      if (dd<=1) set(x,y,0,0,0,Math.round(75*(1-dd)));
    }
  // mascot cells
  for (let gy=0;gy<GH;gy++) for (let gx=0;gx<GW;gx++){
    const ty=cellType(gx,gy); if(!ty) continue;
    const col = ty==='eye'?EYE:(ty==='edge'?EDGE:BODY);
    const px=ox+gx*cell, py=oy+gy*cell;
    for (let yy=0;yy<cell;yy++) for (let xx=0;xx<cell;xx++) set(px+xx,py+yy,col[0],col[1],col[2],255);
  }
  return buf;
}

function crc32(buf){let c=~0;for(let i=0;i<buf.length;i++){c^=buf[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return (~c)>>>0;}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length,0);const t=Buffer.from(type,'ascii');const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])),0);return Buffer.concat([len,t,data,crc]);}
function encodePNG(W,H,rgba){
  const sig=Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
  const raw=Buffer.alloc((W*4+1)*H);
  for(let y=0;y<H;y++){raw[y*(W*4+1)]=0;rgba.copy(raw,y*(W*4+1)+1,y*W*4,y*W*4+W*4);}
  const idat=zlib.deflateSync(raw,{level:9});
  return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',idat),chunk('IEND',Buffer.alloc(0))]);
}
function write(name,W,H,frac,shiftY){fs.writeFileSync(path.join(OUT,name),encodePNG(W,H,makeIcon(W,H,frac,shiftY)));console.log('wrote',name,W+'x'+H);}

write('icon-192.png',192,192,0.62,-0.02);
write('icon-512.png',512,512,0.62,-0.02);
write('icon-maskable-192.png',192,192,0.50,-0.02);
write('icon-maskable-512.png',512,512,0.50,-0.02);
write('apple-touch-icon.png',180,180,0.62,-0.02);
write('favicon-32.png',32,32,0.74,0);
write('favicon-16.png',16,16,0.80,0);
write('og-image.png',1200,630,0.72,-0.03);
