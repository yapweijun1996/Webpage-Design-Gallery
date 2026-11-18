import {shopIslandZ, shopLamp} from './window-studios.js';

const brass = 0xc9a56d, walnut = 0x66412f, ivory = 0xf3ead8, graphite = 0x282a2a;

// A filled profile facing the shopfront. Adjacent layers can share an edge and
// retain a soft silhouette from the entrance without a texture or alpha pass.
function profile(t, x, z, width, lower, upper, color, steps = 32) {
  const points = [], indices = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, px = x + (u - .5) * width;
    points.push([px, lower(u), z], [px, upper(u), z]);
    if (i) {
      const a = (i - 1) * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  t.surface(points, indices, color);
}

function coastalRelief(t, z, clinical) {
  const w = clinical ? 3.86 : 3.65, low = .54, high = 3.16;
  t.box(0, (low + high) / 2, z, w + .11, high - low + .1, .11, clinical ? ivory : brass);
  t.box(0, (low + high) / 2, z + .066, w, high - low, .04, clinical ? 0xdfdfcd : 0xacc4b8);
  const stone = clinical ? [0xb6c8aa, 0x95b290, 0x7f9d82] : [0x799d90, 0x447c70, 0x336357];
  for (let i = 0; i < 3; i++) {
    const wave = u => 2.57 - i * .58 + (.24 + .035 * i) * Math.sin(u * 6.7 + i * .7) + .15 * Math.sin(u * 10.7 + .4 * i);
    const face = z + .096 + i * .014;
    profile(t, 0, face, w, () => low, wave, stone[i]);
    profile(t, 0, face + .003, w, u => wave(u) - .045, wave, clinical ? shopLamp : 0xe6d6ba);
  }
}

function television(t, x, y, z, w, h, sunset) {
  t.box(x, y, z, w, h, .075, graphite);
  const face = z + .044, iw = w - .055, ih = h - .055;
  const bottom = y - ih / 2, cut = v => y + ih * v;
  t.box(x, y, face, iw, ih, .011, sunset ? 0x434476 : 0x28365b);
  const sky = sunset ? [[75,81,132],[222,147,150],[255,206,145]] : [[49,68,111],[136,124,155],[239,175,152]];
  for (let i=0; i<32; i++) {
    const v=i/31, segment=v>.5?1:0, f=v*2-segment;
    const rgb=sky[segment].map((c,k)=>Math.round(c+(sky[segment+1][k]-c)*f));
    const tint=(rgb[0]<<16)|(rgb[1]<<8)|rgb[2];
    const top=.5-i/32, lower=.5-(i+1)/32;
    profile(t,x,face+.009,iw,()=>cut(lower),()=>cut(top),tint,1);
  }
  t.disc(x+iw*(sunset? .21:-.24),cut(.065),face+.014,ih*.078,.004,0xf3c7a2);
  const peaks = sunset ? [0,.11,.30,.12,.20,.05,.14,.03,.08] : [.12,.21,.02,.12,.05,.29,.14,.06,.15];
  const ridge = u => {
    const p = u * (peaks.length - 1), left = Math.min(peaks.length - 2, Math.floor(p));
    return peaks[left] + (peaks[left + 1] - peaks[left]) * (p - left);
  };
  profile(t,x,face+.019,iw,() => bottom,u => cut(ridge(u) - .13),sunset ? 0x6d6078 : 0x665c79,24);
  profile(t,x,face+.022,iw,() => bottom,u => cut(ridge(1-u)*.73 - .27),sunset ? 0x453e55 : 0x41435b,24);
  profile(t,x,face+.025,iw,() => bottom,u => cut(.065*Math.sin(u*9+.4) - .33),sunset ? 0x272c3b : 0x2d354b,18);
}

// A round appliance door on a side-facing cabinet, seen in profile when walking in.
function washerDoor(t, x, y, z, r, color) {
  const points=[[x,y,z]], indices=[];
  for (let i=0; i<24; i++) {
    const a=i*Math.PI/12;
    points.push([x,y+r*Math.sin(a),z+r*Math.cos(a)]);
    indices.push(0,i+1,(i+1)%24+1);
  }
  t.surface(points,indices,color);
}

export function buildLateShopAnchorDetails(n, t, width, depth) {
  if (n < 10 || n > 17) return;
  const {box, column, disc, arch, bar, tapered, ellipse, block} = t;
  const back=-depth/2+.64, side=width/2-.23, island=shopIslandZ;

  if (n === 10) {
    coastalRelief(t,back+.12,false);
    for (const s of [-1,1]) {
      const x=s*(side-.31);
      block(x,1.03,0,.51,1.89,4.55);
      box(x,.49,0,.46,.78,4.52,0x668a75);
      box(x,.90,0,.53,.08,4.57,ivory);
      for (const end of [-2.20,2.20]) box(x,1.55,end,.035,1.36,.042,brass);
      box(x,1.42,0,.44,.052,4.44,ivory);
      box(x,2.20,0,.46,.07,4.48,brass);
      for (const z of [-1.65,-.55,.55,1.65]) {
        // Face local X to present each ribbed oyster fan into the shop.
        for(let j=-3;j<=3;j++) {
          const a=j*.25, h=.25-.018*Math.abs(j);
          ellipse(x,1.49+h*Math.cos(a),z+h*Math.sin(a),.078,h,.042,j%2?0xeadcc6:0xffecd6,Math.PI/2,a);
        }
        ellipse(x-s*.088,1.49,z,.098,.050,.155,0xc3c7ad,0,0);
        ellipse(x-s*.13,1.54,z,.063,.063,.063,ivory,0,0);
      }
    }
    return;
  }

  if (n === 11) {
    arch(0,.25,back+.09,2.76,.65,.13,walnut);
    return;
  }

  if (n === 12) {
    coastalRelief(t,back+.13,true);
    return;
  }

  if (n === 13) {
    block(0,1.13,back+.30,2.88,.34,.60);
    box(0,1.08,back+.28,2.86,.20,.56,graphite);
    box(0,1.18,back+.28,2.86,.035,.58,brass);
    box(0,1.28,back+.33,1.52,.12,.15,graphite);
    for(const s of [-1,1]) {
      const x=s*(side-.12);
      box(x,1.78,0,.095,1.69,4.80,0x302d2a);
      for(let i=0;i<12;i++) box(x-s*.10,2.91,-2.20+i*.40,.18,.53,.055,walnut);
      box(x-s*.12,2.60,0,.070,.050,4.75,shopLamp);
      for (let j=-1;j<=1;j++) {
        const z=j*.92, px=s*(side-.72);
        for(const h of [1.13,1.31]) {
          ellipse(px-.146*s,h,z,.024,.063,.062,0x676661,0,0);
        }
      }
    }
    return;
  }

  if (n === 14) {
    television(t,1.36,1.91,back+.3,1.95,1.14,true);
    const x=side-.50;
    block(x,.68,-.60,.78,1.18,2.43);
    box(x,.17,-.60,.84,.17,2.52,ivory);
    for(const z of [-1.19,-.01]) {
      box(x,.75,z,.67,1.02,1.05,0xa5a49c);
      box(x-.345,1.09,z,.024,.17,.98,0xd5d0c2);
      box(x-.36,1.08,z-.24,.02,.073,.25,graphite);
      washerDoor(t,x-.35,.65,z,.364,0x666a6c);
      washerDoor(t,x-.36,.65,z,.309,0x2f373b);
      washerDoor(t,x-.37,.65,z,.205,0x454e54);
    }
    // A small floral arrangement picks up the warm upholstery and screen colours.
    tapered(.71,.81,island,.110,.136,.29,0xb0a78e);
    for(let j=0;j<7;j++) {
      const a=j*2.4, px=.71+.13*Math.cos(a), pz=island+.12*Math.sin(a), h=1.01+(j%3)*.055;
      bar(.71,.93,island,px,h,pz,.014,0x576948);
      ellipse(px,h,pz,.068,.060,.055,j%2?0x914956:0xb36864,0,0);
    }
    return;
  }

  if (n === 15) {
    // The rear walnut fluting crests in a wave above the watch vitrine.
    const width=5.88;
    const crest = u => 2.78+.24*Math.sin(u*8.4-.7)+.11*Math.sin(u*15+.2);
    profile(t,0,back+.105,width,() => .72,crest,0x4f342a);
    profile(t,0,back+.108,width,u => crest(u)-.035,crest,brass);
    for(let i=0;i<37;i++) {
      const u=(i+.5)/37, x=(u-.5)*width, top=crest(u)-.044;
      box(x,(top+.72)/2,back+.139,.051,top-.72,.06,i%3 ? walnut : 0x896346);
    }
    const uprightX=side-.22, uprightZ=back+2.28;
    block(uprightX,.81,uprightZ,.40,1.43,1.88);
    box(uprightX,.91,uprightZ,.30,1.51,1.84,graphite);
    box(uprightX-.024,1.67,uprightZ,.35,.065,1.90,walnut);
    box(uprightX-.19,.97,uprightZ,.20,.09,1.68,walnut);
    for(let i=0;i<29;i++) {
      const z=uprightZ+(i-14)*.055;
      box(uprightX-.20,1.022,z,.18,.02,.050,ivory);
      if (![2,6].includes(i%7)) box(uprightX-.14,1.044,z+.026,.11,.026,.024,graphite);
    }
    return;
  }

  if (n === 16) {
    for(let i=-1;i<=1;i++) {
      const x=i*1.86;
      block(x,1.52,back+.25,1.70,2.78,.55);
      box(x,1.65,back+.06,1.70,2.56,.20,0xd5d8c5);
      box(x,1.75,back+.175,1.54,2.18,.042,ivory);
      for(const edge of [-.78,.78]) box(x+edge,1.76,back+.207,.034,2.21,.018,shopLamp);
      for(const y of [.65,1.32,1.99]) {
        box(x,y,back+.31,1.52,.069,.39,0xb3ba95);
        for(let j=-2;j<=2;j++) {
          const px=x+j*.235, top=y+.39;
          column(px,y+.20,back+.32,.083,.32,0x809934);
          column(px,top-.039,back+.32,.084,.074,graphite);
          column(px,top+.009,back+.32,.043,.031,0xbac1b8);
        }
      }
      box(x,.37,back+.22,1.70,.38,.40,0xacbc38);
    }
    for(const x of [1.62]) {
      const z=island+(x>0?.32:0);
      box(x,.30,z+.499,1.45,.041,.023,shopLamp);
      box(x,1.075,z,1.17,.075,.42,0xcecfb4);
      for(const dx of [-.43,0,.43]) {
        const px=x+dx; column(px,1.25,z,.082,.28,0xa7b752);
        column(px,1.36,z,.083,.06,graphite);column(px,1.40,z,.045,.025,0xcdd0c0);
      }
    }
    return;
  }

  box(0,1.99,back,4.80,3.84,.20,0x46413f);
  for(let i=0;i<4;i++) {
    const r=.59+i*.38, start=.43, end=Math.PI-.43, steps=34;
    for(let j=0;j<steps;j++) {
      const a=start+(end-start)*j/steps, b=start+(end-start)*(j+1)/steps;
      bar(r*Math.cos(a),1.50+r*Math.sin(a),back+.123,r*Math.cos(b),1.50+r*Math.sin(b),back+.123,.047,i%2?shopLamp:brass);
    }
  }
  block(0,1.18,back+.39,3.64,.62,.59);
  box(0,.96,back+.38,3.58,.21,.57,0x302d2c);
  box(0,1.07,back+.38,3.61,.035,.59,brass);
  for(const x of [-1.23,-.62,0,.62,1.23]) {
    box(x,1.14,back+.42,.26,.11,.22,graphite);
    box(x,1.31,back+.43,.145,.32,.091,0x686a68);
    box(x,1.36,back+.486,.10,.11,.015,0xb6cbc4);
  }
  for (const s of [-1,1]) {
    const x=s*(side-.18), centre=back+3.04;
    block(x,1.39,centre,.34,2.48,2.86);
    box(x,1.41,centre,.15,2.44,2.84,0x51463b);
    for(const h of [.75,1.52,2.42]) {
      box(x-s*.12,h,centre,.31,.058,2.83,brass);
      box(x-s*.26,h-.035,centre,.032,.026,2.74,shopLamp);
      if (h<2) for (const offset of [-.95,-.34,.34,.95]) {
        const z=centre+offset;
        box(x-s*.12,h+.077,z,.17,.10,.22,graphite);
        box(x-s*.11,h+.22,z,.11,.28,.14,0xe2d2b9);
        box(x-s*.176,h+.24,z,.014,.095,.095,graphite);
      }
    }
  }
  for(let k=0;k<30;k++) {
    const a=k*Math.PI/15;
    box(1.116*Math.cos(a),.65,island+1.116*Math.sin(a),.045,.72,.042,0x6e6255);
  }
}
