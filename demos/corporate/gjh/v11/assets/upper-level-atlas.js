// The upper level uses the shop kit's colour tokens and guttered atlas UVs.
import {swatch} from './signage/tokens.js';
import {extrudeArtworkGutter, setupArtworkTexture} from './artwork-textures.js';

export const atlasPx = 256;
export const categories = ['Fashion', 'Lifestyle', 'Tech & Games', 'Food & Drinks'];
export const cells = {
  directory:{x:2,y:2,w:155,h:146}, mark:{x:161,y:2,w:93,h:67},
  signs:categories.map((_,i)=>({x:161,y:73+i*22,w:93,h:19})),
  rug:{x:2,y:153,w:49,h:100},
  windows:categories.map((_,i)=>({x:60+i%2*98,y:165+Math.floor(i/2)*46,w:94,h:42})),
  sky:{x:54,y:164,w:3,h:89}, filament:{x:88,y:151,w:8,h:6}, louvres:{x:100,y:151,w:55,h:11}
};

export function paintUpperAtlas(T, mark, tier) {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=atlasPx;
  const ctx=canvas.getContext('2d');
  const {green,brass,cream}=swatch;
  ctx.fillStyle=green; ctx.fillRect(0,0,atlasPx,atlasPx);
  function inCell(cell,draw){
    ctx.save();ctx.translate(cell.x,cell.y);ctx.beginPath();ctx.rect(0,0,cell.w,cell.h);ctx.clip();
    draw(cell.w,cell.h);ctx.restore();
    extrudeArtworkGutter(ctx,cell,1);
  }
  inCell(cells.directory,(w,h)=>{
    ctx.strokeStyle=brass; ctx.strokeRect(1.5,1.5,w-3,h-3);
    ctx.fillStyle=swatch.gold;ctx.font='bold 11px Arial';ctx.fillText('DIRECTORY',9,16);
    ctx.fillStyle=cream;ctx.font='bold 21px Georgia';ctx.fillText('Upper Level',9,39);
    ctx.fillStyle=brass;ctx.fillRect(9,46,w-18,1);
    categories.forEach((name,i)=>{
      const y=66+i*23;
      ctx.fillStyle=cream;ctx.font='bold 17px Arial';ctx.fillText(name,9,y,118);
      // Facing west at the totem, turn right for the north aisle or left for the south.
      ctx.save();ctx.translate(140,y-6);ctx.rotate(i<2?Math.PI/2:-Math.PI/2);
      ctx.strokeStyle=swatch.gold;ctx.lineWidth=2;ctx.beginPath();
      ctx.moveTo(0,6);ctx.lineTo(0,-6);ctx.moveTo(-5,-1);ctx.lineTo(0,-6);ctx.lineTo(5,-1);ctx.stroke();ctx.restore();
    });
  });
  inCell(cells.mark,(w,h)=>{
    ctx.textAlign='center';ctx.fillStyle=cream;
    if(mark){
      ctx.drawImage(mark,4,3,85,38);
    }else{ctx.font='bold 32px Georgia';ctx.fillText('GJH',w/2,35);}
    ctx.fillStyle=cream;ctx.font='bold 15px Georgia';ctx.fillText('Virtual Mall',w/2,h-7);
  });
  cells.signs.forEach((cell,i)=>inCell(cell,(w,h)=>{
    ctx.fillStyle=i%2?'#49372e':green;ctx.fillRect(0,0,w,h);
    ctx.fillStyle=cream;ctx.textAlign='center';ctx.font='bold 14px Georgia';ctx.fillText(categories[i],w/2,14,w-4);
  }));
  cells.windows.forEach((cell,i)=>inCell(cell,(w,h)=>{
    const glow=ctx.createLinearGradient(0,0,0,h);
    for(const [stop,c] of [[0,'#fff0be'],[.28,'#e7b782'],[.82,'#a77755'],[1,'#604737']])glow.addColorStop(stop,c);
    ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    for(let x=2;x<w;x+=11){ctx.fillStyle='#966d4938';ctx.fillRect(x,0,1,h);}
    const rect=(c,x,y,b,d)=>{ctx.fillStyle=c;ctx.fillRect(x,y,b,d);};
    const poly=(color,points)=>{
      ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],j)=>j?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();
    };
    for(const x of [15,46,77])poly('#fff4c13a',[[x,2],[x+13,28],[x-13,28]]);
    if(i===0){
      rect('#654d36',8,10,76,1);
      for(let j=0;j<6;j++){
        const x=15+j*12;
        poly(['#577464','#ad6550','#e5cdaa'][j%3],[[x,10],[x+5,12],[x+7,17],[x+4,18],[x+5,31],[x-4,31],[x-3,18],[x-6,17],[x-4,12]]);
      }
    }else if(i===2){
      for(let j=0;j<3;j++){
        const x=8+j*28;rect('#3a3d39',x,13,21,14);rect('#6f9497',x+1,14,19,11);
        poly('#b1c0a7',[[x+1,23],[x+8,17],[x+13,21],[x+20,15],[x+20,24]]);
        rect('#504b3c',x+9,27,3,3);rect('#504b3c',x+5,30,11,1);
      }
    }else{
      for(const shelf of [18,33]){
        rect('#72523b',6,shelf,81,2);
        for(let j=0;j<6;j++){
          const x=11+j*13,h=5+(j*7+shelf)%6;
          rect(i===1?'#57765c':['#954f38','#e0c18c','#646f51'][j%3],x,shelf-h,6,h);
          rect(i===1?'#708355':'#b99964',x+1,shelf-h-2,4,2);
        }
      }
    }
    poly('#fff8d923',[[4,0],[14,0],[36,h],[31,h]]);
  }));
  inCell(cells.rug,(w,h)=>{
    ctx.fillStyle='#c6b598';ctx.fillRect(0,0,w,h);
    for(let i=2;i<7;i+=2){ctx.strokeStyle=i===4?'#d5c8ad':'#74684e';ctx.strokeRect(i+.5,i+.5,w-2*i-1,h-2*i-1);}
    for(let y=10;y<h-8;y+=9)for(let x=10+(y%2)*4;x<w-7;x+=9){
      ctx.strokeStyle='#998970';ctx.beginPath();ctx.moveTo(x-2,y);ctx.lineTo(x,y-2);ctx.lineTo(x+2,y);ctx.lineTo(x,y+2);ctx.closePath();ctx.stroke();
    }
  });
  inCell(cells.sky,(w,h)=>{
    const sky=ctx.createLinearGradient(0,0,0,h);
    for(const [stop,c] of [[0,'#67a5c6'],[.42,'#a6d4e2'],[.78,'#edf2de'],[1,'#ffe4c2']])sky.addColorStop(stop,c);
    ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  });
  inCell(cells.louvres,(w,h)=>{
    ctx.fillStyle='#5e6353';ctx.fillRect(0,0,w,h);
    for(let x=0;x<w;x+=4){ctx.fillStyle='#857c60';ctx.fillRect(x,0,1,h);ctx.fillStyle='#434d42';ctx.fillRect(x+1,0,1,h);}
    ctx.fillStyle='#a68d64';ctx.fillRect(0,0,w,1);
  });
  inCell(cells.filament,(w,h)=>{ctx.fillStyle='#ffedba';ctx.fillRect(0,0,w,h);});
  return setupArtworkTexture(T,new T.CanvasTexture(canvas),tier);
}
