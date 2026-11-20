import {atriumLayout} from './atrium-layout.js';
import {expandedLayout, shopEntrance} from './expanded-layout.js';
import {decalHeight} from './surface-decals.js';

// Walkable rooms based on the fourteen shopfront references.
// Positive Z faces the arcade. Every bay keeps a clear sightline to its rear wall.
const cream=0xf3e5cd, pearl=0xfff3df, brass=0xcaa15b, oak=0xb18356, walnut=0x66412f;
const sage=0x76846a, charcoal=0x2d3032, silver=0xc4c3bd, white=0xf7f4e9;
// Keeping the centre fixtures behind the threshold leaves a turning area in
// front and two routes around each island. Countertop GLBs use this same datum.
export const shopIslandZ = -.63;
export const pzhCartonX = .54;
export const pzhCartonStandingZ = shopIslandZ + 1.36;
export const shopLamp = 0xffe6a7;
const finishes = {
  4:[0xe2cfad,0xa77d82,0xf0dfc7],5:[0x69442c,0x8b5a38,0xe3c79c],
  6:[0xb28a5c,0xc59d69,0xead5b8],7:[0x762f26,0x8e4d35,0xb58b64],
  8:[0xeee4c9,0x213969,0xf4e9d3],9:[0x273849,0x1d324e,0x47505a],
  10:[0xacc3ac,0x728c78,0xf2e7cf],11:[0x75423a,0x88423c,0xe4d4b6],
  12:[0xe9e9da,0xb1c5a7,0xece9d8],13:[0x66482f,0x363637,0xae9f87],
  14:[0xe3cfb5,0xccb394,0xeee4d7],15:[0x604534,0x694635,0x9c7e61],
  16:[0xf1f1de,0xb1c02f,0xf1efdf],17:[0xaa8464,0x433c39,0xdcc5a8]
};

export function buildWindowStudio(n, t, width, depth, floorColour) {
  const {box, column, disc, bar, arch, ring, ellipse, tapered, block, opaqueWall = box} = t;
  const [wall, base, floor] = finishes[n];
  const back=-depth/2+.38, front=depth/2-.18, side=width/2-.23, span=front-back, mid=(front+back)/2;
  const replace = t.replaceDisplay ?? (build => build());
  const cabinet = (x,z,w,h,d,body,cap) => {
    block(x,(h+.26)/2,z,w+.09,h+.26,d+.09);
    box(x,.12,z,w-.1,.23,d-.1,brass);
    box(x,.18+h/2,z,w,h,d,body);
    box(x,.21+h,z,w+.09,.095,d+.09,cap);
  };
  function ovalCounter(x,z,width,depth,height,color) {
    const radius=depth/2, straight=width-depth;
    block(x,height/2+.07,z,width+.06,height+.12,depth+.06);
    for(const [y,h,r,finish] of [[.16,.18,radius*.95,brass],[height/2+.13,height-.16,radius,color],[height+.075,.10,radius+.025,cream]]) {
      box(x,y,z,straight,h,2*r,finish);
      for(const end of [-1,1])column(x+end*straight/2,y,z,r,h,finish);
    }
    return height+.125;
  }
  function blossomVase(x,y,z,petal) {
    tapered(x,y+.17,z,.15,.20,.32,cream);
    for(let i=0;i<7;i++) {
      const angle=i*2.4, dx=Math.cos(angle)*(.20+.03*(i%3)), dz=Math.sin(angle)*.17, top=y+.66+(i%3)*.12;
      bar(x,y+.26,z,x+dx,top,z+dz,.018,walnut);
      for (let j=0;j<3;j++) ellipse(x+dx+(j-1)*.054,top-.04*Math.abs(j-1),z+dz,.066,.060,.059,petal,angle,0);
    }
  }
  function can(x,y,z,c,r=.105,h=.24) {
    column(x,y+h/2,z,r,h,c); column(x,y+h+.015,z,r*1.02,.03,brass);
  }
  function provisionDisplay(x,z,kind) {
    const checker=kind==='jar', c=checker?0x263e70:base;
    cabinet(x,z,1.45,.49,.81,c,cream);
    if(checker)for(let row=0;row<2;row++)for(let j=0;j<6;j++)if((j+row)%2)
      box(x+(j-2.5)*.22,.33+row*.22,z+.416,.215,.215,.023,white);
    for(let tier=0;tier<3;tier++){
      const count=4-tier, h=.79+tier*.235;
      for(let i=0;i<count;i++){
        const px=x+(i-(count-1)/2)*.249;
        if(kind==='pack')box(px,h+.11,z,.222,.22,.21,i%2?cream:oak);
        else can(px,h,z,i%3?c:0xc6a16f,.114,.20);
      }
    }
  }
  function shellFan(x,y,z,size) {
    // Overlapping, cupped nacre lobes make a continuous shell silhouette.
    for(let i=-5;i<=5;i++){
      const angle=i*.178, height=size*(1-.19*Math.abs(i)/5);
      const radius=.49*height;
      ellipse(x+Math.sin(angle)*radius,y+Math.cos(angle)*radius,z-.035*Math.abs(i),
        .16*size,height*.53,.095*size,i%2?0xebdbc8:pearl,0,-angle);
    }
  }
  // Repeat three package finishes in grouped facings across rear and side bays.
  const packColours = {
    4:[0x765088,0x89a95a,0xebac48], 5:[0xa6392d,0xc69b5b,0x70473a],
    6:[0xdcb567,0x96734a,0xe8ce8c], 7:[0xac302d,0xcf9e50,0x496854],
    8:[0x286098,0xcf8051,0x4377ac], 9:[0x264f89,0xe0af43,0x476d97],
    10:[0x598d82,0xceb897,0x7aa79e], 11:[0xad4141,0x597a55,0xd89e77],
    12:[0x82ad99,0x909aba,0xc78180], 16:[0xa9bf39,0x368070,0x566265],
    17:[0x6e726e,0xb97e59,0x5a666f]
  }[n];
  const packColour = (index, fallback) => packColours?.[index % 3] ?? fallback;
  function packageRow(x,y,z,count,step,kind,c) {
    for(let j=0;j<count;j++) {
      const px=x+(j-(count-1)/2)*step;
      if(kind==='tin') can(px,y,z,packColour(j,c));
      else {
        const h=kind==='pack'?.31:.24;
        box(px,y+h/2,z,.18,h,.13,packColour(j,c));
        box(px,y+h*.43,z+.071,.14,.035,.018,j%3===0?c:cream);
      }
    }
  }
  function shelf(x,z,w,kind='tin',c=base,arched=false) {
    block(x,1.62,z+.20,w,3.18,.57);
    const frame = n>=12 ? silver : brass;
    box(x,1.62,z,w,3.18,.12,wall);
    for(const s of [-1,1]) box(x+s*(w/2-.045),1.62,z+.21,.065,3.16,.48,frame);
    if(arched) arch(x,1.88,z+.17,w*.46,.66,.07,frame);
    for(const h of [.61,1.34,2.07,2.8]) {
      box(x,h,z+.23,w,.085,.50,oak);
      box(x,h-.04,decalHeight(z+.48)-.0175,w-.05,.035,.035,shopLamp);
      // The Low room kit supplies linked, category-shaped stock to these bays.
      const featured = n===4 && x===0 || h===2.07 && x<0 && [5,6,7,8,10,11,12,17].includes(n);
      if (featured && n===11) {
        const pair = [0x9a363a,0xb54b36];
        for (const [i,colour] of pair.entries()) can(x+(i===0?-.59:.59),h+.043,z+.29,colour,.064,.106);
      } else if (featured && n===12) {
        box(x-.55,h+.167,z+.32,.113,.248,.088,white);
        can(x+.55,h+.043,z+.32,cream,.046,.155);
      } else if (!featured) packageRow(x,h+.05,z+.28,Math.floor(w/.27),.25,kind,c);
    }
  }
  function sideShelf(s,c=oak,kind='tin') {
    const x=s*(side-.29);
    block(x-s*.18,1.59,mid,.50,3.13,span-.7);
    box(x,1.58,mid, .15,3.02,span-.7,wall);
    for(let row=0;row<4;row++) {
      const y=.55+row*.66;
      box(x-s*.18,y,mid,.49,.095,span-.82,c);
      box(x-s*.42,y-.035,mid,.025,.025,span-.9,shopLamp);
      // Merchandise is evenly grouped into bays with gaps between collections.
      for(let i=0;i<9;i++) {
        const z=back+.81+i*(span-1.66)/8;
        if(n===4 && s===1 && row===2 && i===3) {
          for (const offset of [-.084,.084]) {
            box(x-.19,y+.194,z+offset,.14,.29,.147,pearl);
            box(x-.264,y+.19,z+offset,.009,.083,.128,base);
          }
        } else if(kind==='tin') can(x-s*.19,y+.05,z,packColour(i+row,base),.10,.21);
        else box(x-s*.19,y+.19,z,.14,.28,.20,packColour(i+row,base));
      }
    }
    for(const z of [back+.4,mid,front-.41]) box(x-s*.26,1.61,z,.08,3.15,.07,brass);
  }
  function pendant(x,z,y,r,c=brass) {
    column(x,(4.09+y)/2,z,.022,4.09-y,brass);
    tapered(x,y,z,r*.46,r,.27,c);column(x,y-.137,z,r*.89,.035,shopLamp);
  }
  function plant(x,z,h) {
    const y=.46;
    block(x,.35,z,.49,.65,.49);
    tapered(x,y/2+.09,z,.23,.17,y,cream);
    for(let k=0;k<6;k++){
      const a=k*2.39,r=.26+(k%2)*.09,dx=Math.cos(a)*r,dz=Math.sin(a)*r,top=h-(k%3)*.18;
      bar(x,y,z,x+dx,top,z+dz,.026,0x536a44);
      ellipse(x+dx,top,z+dz,.12,.29,.08,k%2?0x64804b:0x91a35f,a,dx);
    }
  }
  function circleIsland(x,z,r,h,c) {
    block(x,(h+.30)/2,z,r*2.06,h+.30,r*2.06);
    column(x,.16,z,r*.89,.18,brass); column(x,.22+h/2,z,r,h,c);
    column(x,.25+h,z,r*1.03,.1,cream);
    return h+.31;
  }
  function ringLight(x,z,r,y) {
    ring(x,y,z,r,.036,shopLamp);
    for(const off of [-.68,.68]) column(x+off*r,(4.11+y)/2,z,.012,4.11-y,brass);
  }
  function sofa(x,z,c) {
    block(x,.39,z,1.66,.78,.80);
    box(x,.35,z,1.6,.34,.77,c);box(x,.59,z-.32,1.61,.47,.19,c);
    for(const k of [-1,1])box(x+k*.75,.52,z,.16,.32,.71,c);
  }
  // Floors, side walls and a separate ceiling create real depth when the
  // visitor walks obliquely past the glazing. Aligned reveals frame each view.
  block(0,2.12,back,side*2,4.18,.13);
  block(0,4.19,mid,side*2,.18,span);
  for(const s of [-1,1]) block(s*side,2.10,mid,.13,4.13,span);
  block(0,.041,mid,side*2,.08,span);
  // Floor slabs sample the arcade's existing mineral tile at shop scale.
  box(0,.041,mid,side*2,.08,span,floorColour ?? floor,-2);
  opaqueWall(0,2.12,back,side*2,4.18,.13,wall);
  // Bounced cove light keeps the underside of the plaster ceiling legible.
  box(0,4.19,mid,side*2,.18,span,cream,-3);
  // The north jamb is local +X in the west wing and -X in the east wing.
  // Its pilaster already fills the last section of the wall, including the exposed face.
  const pilasterSide = shopEntrance(expandedLayout.slots[n-1]).normalX;
  const {inset, depth: pierDepth} = atriumLayout.arcadePilaster;
  const pilasterBack = depth/2 - inset - pierDepth/2;
  for(const s of [-1,1]) {
    box(s*(side-.20),4.082,mid,.40,.064,span,pearl,-3);
    const wallEnd = s === pilasterSide ? pilasterBack : front;
    opaqueWall(s*side,2.10,(back+wallEnd)/2,.13,4.13,wallEnd-back,wall);
    box(s*(side-.31),4.05,mid,.065,.046,span-.6,shopLamp);
    box(s*(side-.2),.19,mid,.15,.21,span,base);
  }
  for(const z of [back+.38,front-.46]) box(0,4.04,z,width-.9,.045,.08,shopLamp);
  for(const x of [-side*.64,0,side*.64])for(const z of [back+1.3,mid+.25,front-1.13])
    column(x,4.076,z,.078,.045,shopLamp);
  if(n<13 && n!==10) {
    if(n!==5) sideShelf(-1,oak,n===4||n===6||n===12?'pack':'tin');
    sideShelf(1,n===5?walnut:oak,n===4||n===6||n===12?'pack':'tin');
  }
  // The fascia faces shoppers on the arcade. Its companion plaque faces the
  // doorway from inside the room; the green pictogram marks the way back out.
  box(0,3.69,back+.46,3.68,.47,.27,brass);
  const exitZ=front-.04;
  box(0,3.78,exitZ,.67,.29,.07,0x195f47);
  for(const x of [-.165,.165]) box(x,3.78,exitZ-.044,.026,.207,.016,pearl);
  box(0,3.885,exitZ-.044,.35,.022,.016,pearl);
  disc(.045,3.826,exitZ-.06,.03,.018,pearl);
  bar(.02,3.794,exitZ-.059,-.015,3.74,exitZ-.059,.034,pearl);
  bar(-.008,3.75,exitZ-.06,.045,3.70,exitZ-.06,.024,pearl);
  bar(-.008,3.75,exitZ-.06,-.074,3.717,exitZ-.06,.024,pearl);
  const rear=back+.26, island=shopIslandZ;
  const windowX=-side+1.1,windowZ=front-.94;
  if([6,7,8,9,11].includes(n)) provisionDisplay(windowX,windowZ,n===6?'pack':n===8?'jar':'tin');
  switch(n) {
    case 4: { // Borsch Med: a dusty rose oval counter, flowers and shaded countertop lamps.
      for(let i=-1;i<=1;i++)shelf(i*1.86,rear,1.75,'pack',sage);
      replace(() => {
        const cx=-.58, top=ovalCounter(cx,island,2.85,1.27,1.16,0xc5979d);
        for(let i=-6;i<=6;i++)box(cx+i*.115,.68,island+.64,.028,.91,.035,0xcc9e9c);
        for(const end of [-1,1])for(let k=0;k<=8;k++){
          const a=k*Math.PI/8;
          column(cx+end*(.79+.63*Math.sin(a)),.68,island+.63*Math.cos(a),.018,.91,0xcc9e9c);
        }
        for(const x of [-1.17,-.78])can(x,top,island+.18,white,.10,.24);
        blossomVase(-.29,top,island-.20,0xd5a0a1);
        for(const x of [-1.50,.38]){
          column(x,top+.21,island+.04,.032,.42,brass);
          ellipse(x,top+.43,island+.04,.22,.17,.22,pearl,0,0);
        }
      }, sage);
      pendant(-.9,island,3.26,.30,white); plant(side-.96,front-.74,1.6); break;
    }
    case 5: { // Timber apothecary drawers wrap around a circular porcelain niche.
      for(let s=-1;s<=1;s++)shelf(s*2.1,rear,1.88,'tin',0xd1ad81);
      const wallX=-side+.25, nicheZ=mid+.46;
      block(wallX+.14,1.52,mid,.56,3.02,span-.66);
      box(wallX,1.54,mid,.32,2.98,span-.66,walnut);
      const columns=Math.floor((span-.8)/.63), pitch=(span-.8)/columns;
      for(let i=0;i<columns;i++)for(let j=0;j<5;j++) {
        const z=back+.50+(i+.5)*pitch,y=.47+j*.48;
        if(Math.abs(z-nicheZ)<1.12&&y>.70)continue;
        box(wallX+.175,y,z,.08,.445,pitch-.035,0x8b5a38);
        ellipse(wallX+.237,y,z,.035,.046,.075,brass,0,0);
      }
      ellipse(wallX+.22,1.95,nicheZ,.045,1.07,1.07,brass,0,0);
      ellipse(wallX+.27,1.95,nicheZ,.048,1,1,0x4b3427,0,0);
      for(const y of [1.43,2.14]) {
        box(wallX+.37,y,nicheZ,.34,.06,1.65,oak);
        for(const dz of [-.35,.34]) {
          ellipse(wallX+.42,y+.19,nicheZ+dz,.14,.17,.15,pearl,0,0);
          tapered(wallX+.42,y+.37,nicheZ+dz,.098,.08,.13,pearl);
        }
      }
      cabinet(0,island,2.5,.99,1.24,walnut,oak);
      blossomVase(-.98,1.2475,island-.14,0x96a76a);
      break;
    }
    case 6: { // A timber drying rack above the service counter and a curved rear display niche.
      for(const x of [-2.04,2.04])shelf(x,rear,1.70,'pack',0xcb9f67);
      arch(0,.30,rear+.18,1.07,1.41,.15,cream);
      for(const h of [.75,1.45]){
        box(0,h,rear+.26,2.13,.07,.40,oak);
        for(const x of [-.69,-.20,.51])tapered(x,h+.17,rear+.25,.16,.09,.28,pearl);
      }
      replace(() => {
        cabinet(-.36,island,2.78,.92,1.26,oak,cream);
        for(const offset of [-.84,-.28,.28,.84]) {
          const centre=-.36+offset;
          for(let j=-3;j<=3;j++){
            const h=.77+(j%2)*.07+(offset>0?.08:0);
            box(centre+j*.043,3.03-h/2,island-.15,.029,h,.04,j%2?0xe2bb76:0xebcf96);
          }
        }
        box(-.36,3.08,island-.15,2.53,.076,.11,brass);
        for(const x of [-1.43,.71])bar(x,3.08,island-.15,x,3.96,island-.15,.031,brass);
      }, oak);
      for(let z=back+.8;z<front;z+=1.36)box(0,3.96,z,side*2,.12,.15,oak);
      break;
    }
    case 7: { // Gu Long's coffered ceiling and two-tier beaded chandelier frame its lacquer displays.
      for(let i=-1;i<=1;i++)shelf(i*1.93,rear,1.79,'tin',0xa74632,true);
      for(const x of [-1,1])pendant(x,mid+1.2,2.91,.34,brass);
      for(const dx of [-1.85,0,1.85])box(dx,4.015,mid,.075,.12,span-.6,walnut);
      for(let z=back+.83;z<front;z+=1.82)box(0,4.01,z,side*2-.45,.14,.12,walnut);
      for(const [r,y,count] of [[.72,3.43,20],[.45,3.17,14]]) {
        ringLight(-2.07,mid-.88,r*.78,y);
        for(let j=0;j<count;j++){
          const a=j*Math.PI*2/count;
          tapered(-2.07+r*.78*Math.cos(a),y-.111,mid-.88+r*.78*Math.sin(a),.050,.028,.21,j%3?pearl:shopLamp);
        }
      }
      replace(() => {
        const top=circleIsland(0,island,1.14,.82,walnut);
        column(0,top+.13,island,.72,.26,brass);
        for(let level=0;level<3;level++)for(let j=0;j<5-level;j++)can((j-(4-level)/2)*.24,top+.27+level*.269,island,0xaa4638);
      }, base);
      break;
    }
    case 8: { // A gold peanut in a blue arched niche is the focal point above Skippy's jar display.
      for(const x of [-1.96,1.96])shelf(x,rear,1.54,'tin',0x466c9b,true);
      disc(0,1.92,rear+.13,1.08,.11,base);box(0,1.17,rear+.132,2.16,1.50,.11,base);
      arch(0,.42,rear+.223,1.08,1.50,.072,brass);
      for(const [x,y,rx,ry] of [[-.32,1.84,.39,.29],[.06,2.01,.23,.143],[.38,2.17,.32,.22]])
        ellipse(x,y,rear+.25,rx,ry,.11,0xd8a34f,0,.37);
      for(const [x,y] of [[-.43,1.80],[-.22,1.89],[.29,2.13],[.47,2.21]]) {
        bar(x-.052,y-.07,rear+.352,x+.052,y+.07,rear+.352,.018,0xb88b49);
        bar(x+.06,y-.05,rear+.352,x-.06,y+.05,rear+.352,.017,0xb88b49);
      }
      replace(() => {
        const top=circleIsland(0,island,1.08,.85,base);
        for(let i=0;i<32;i++){
          const a=i*Math.PI/16;column(1.07*Math.cos(a),.66,island+1.07*Math.sin(a),.035,.78,0x47719a);
        }
        for(let i=-2;i<=2;i++)can(i*.28,top,island,0xd2a66c,.12,.33);
      }, base);
      for(const x of [-1.83,1.83])pendant(x,mid+.2,3.1,.45,cream);break;
    }
    case 9: { // A navy terrazzo floor, lit ochre niche and rounded ribbed counter.
      disc(0,1.63,rear+.06,1.58,.13,0xdba735);
      box(0,.98,rear+.062,3.16,1.31,.13,0xdba735);
      for(let k=0;k<3;k++) {
        const w=2.48-.43*k;box(0,.85+k*.52,rear+.36,w,.08,.43,brass);
        // The room kit stocks these three ledges with rounded, banded tins.
      }
      const cx=-.48;
      replace(() => {
        ovalCounter(cx,island,2.58,1.13,1.01,base);
        for(let j=-5;j<=5;j++)box(cx+j*.143,.62,island+.563,.025,.74,.027,0x41546b);
      }, base);
      for(const z of [mid+.35,mid-2.65]){
        const pendantX = 2.92;
        column(pendantX,3.74,z,.025,.64,brass);
        for(const [y,r] of [[3.56,.43],[3.44,.31],[3.35,.16]]){
          tapered(pendantX,y,z,r*.62,r,.10,brass);column(pendantX,y-.054,z,r*.89,.025,shopLamp);
        }
      }
      plant(side-1.15,rear+1.31,1.78);break;
    }
    case 10: // California Mexico: pearl shell fans, green stone and tiered seafood islands.
      for(const s of [-1,1]) {
        const x=s*(side-1),z=front-1.5;
        shellFan(x,.62,z,1.97);
        shellFan(x+s*.31,.56,z+.29,1.0);
        circleIsland(x,z+.05,.65,.53,base);
        shelf(s*2.1,rear,1.58,'tin',sage,true);
      }
      replace(() => circleIsland(0,island,1.2,.79,base),base);
      for(let i=0;i<4;i++)pendant(2.15+.29*Math.sin(i*2.4),mid-.66+i*.38,3.13+i*.12,.13,pearl);break;
    case 11: // Hormel: a working pantry table, open produce crates and burgundy can shelves.
      for(let i=-1;i<=1;i++)shelf(i*1.83,rear,1.73,'tin',0x8a3e3e);
      replace(() => {
        block(0,.58,island,2.74,1.16,1.24);
        for(const x of [-1.21,1.21])for(const dz of [-.46,.46])box(x,.60,island+dz,.14,1.05,.14,walnut);
        box(0,1.08,island,2.74,.17,1.24,oak);
        for(const x of [-.75,0,.75]){
          box(x,.39,island,.64,.46,.62,oak);
          for(let j=-1;j<=1;j++)ellipse(x+j*.17,1.27,island,.10,.12,.10,j%2?sage:0xab5d41,0,0);
        }
      }, base);
      pendant(-.69,mid,3,.38,base);pendant(.69,mid,3,.38,base);break;
    case 12: // Zeria: light mint shelving, layered white islands and a planted clinical interior.
      for(const x of [-2.2,2.2])shelf(x,rear,1.43,'pack',base,true);
      replace(() => {
        circleIsland(0,island,1.10,.72,white);
        packageRow(.10,1.18,island+.11,4,.23,'pack',base);
      }, base);
      for(const x of [-side+.88,side-.88])plant(x,front-.87,1.64);
      ringLight(0,mid,1.38,3.76);break;
    case 13: // Sony: slatted timber listening lounge, dark screen and contrasting upholstered seating.
      for(let i=-15;i<=15;i++)box(i*.185,1.95,rear,.085,3.67,.12,i%3?walnut:oak);
      replace(() => { sofa(-1.46,island,0xa49784); sofa(.44,mid-1.66,0x786b5f); },charcoal);
      circleIsland(.68,island+.48,.39,.32,walnut);
      for(const x of [-2.5,2.5]){block(x,1.09,rear+.58,.46,1.99,.5);box(x,1.09,rear+.58,.43,1.99,.44,charcoal);for(const y of [.72,1.41])disc(x,y,rear+.826,.135,.036,silver);}
      ringLight(0,mid+.06,1.12,3.69);plant(-side+.7,front-.85,1.53);
      for(const s of [-1,1]) {
        cabinet(s*(side-.65),mid,.65,.72,2.8,walnut,base);
        for(const dz of [-.92,.92]) box(s*(side-.72),1.19,mid+dz,.28,.48,.30,charcoal);
        if (s<0) {
          const sampleX = -(side-.72);
          box(sampleX,.991,mid,.20,.026,.22,walnut);
          // The reference Walkman is 56.5 × 98.4 × 11.8 mm.
          box(sampleX,1.0532,mid,.0118,.0984,.0565,charcoal);
          box(sampleX+.0062,1.066,mid,.001,.055,.045,0x222f36);
        } else box(s*(side-.72),1.19,mid,.28,.48,.30,charcoal);
      }
      break;
    case 14: // LG: side-by-side picture walls, ivory sofa, satin appliances and a halo light.
      for(const x of [-1.36,1.36]) arch(x,.21,rear+.11,1.13,1.98,.12,shopLamp);
      sofa(-.86,mid,cream);circleIsland(.71,island,.52,.37,oak);ringLight(0,mid,1.38,3.72);
      for(const x of [-side+.61,-side+1.30]){
        block(x,1.24,mid+1,.62,2.23,.66);
        box(x,1.24,mid+1,.61,2.23,.64,silver);box(x,1.44,mid+1.34,.49,.035,.04,charcoal);
      }
      plant(-side+.81,front-.85,1.61);break;
    case 15: // Casio: walnut slatted ceiling, instrument gallery and bench.
      for(let i=-5;i<=5;i++)box(i*.58,4.04,mid,.23,.065,span-.28,0xcaaf8e);
      replace(() => cabinet(-1.05,mid-.59,1.78,.9,1.11,walnut,oak),walnut);
      block(1.1,.65,mid-.9,1.64,1.29,.92);
      block(1.10,.34,mid+.16,1.01,.70,.50);
      for(const x of [.46,1.73])box(x,.51,mid-.87,.13,.84,.13,charcoal);
      box(1.1,1.1,mid-.93,1.63,.36,.72,charcoal);
      // Unprinted 930 × 258 × 83 mm portable-keyboard study on the teaching stand.
      const keyboardZ = mid-.69;
      box(1.10,1.3215,keyboardZ,.930,.083,.258,charcoal);
      for (let key=0;key<36;key++) {
        const keyX = 1.10 + (key-17.5)*.0233;
        box(keyX,1.366,keyboardZ+.071,.0213,.006,.104,pearl);
        if (key<35 && [0,1,3,4,5].includes(key%7)) {
          box(keyX+.01165,1.374,keyboardZ+.038,.012,.020,.066,0x1d2424);
        }
      }
      box(1.10,.61,mid+.16,.99,.16,.49,charcoal);
      for(const x of [.74,1.46])box(x,.33,mid+.16,.08,.48,.36,walnut);
      pendant(-1.36,mid-1.3,2.94,.26,brass);break;
    case 16: // GP: white modular product wall, lime base cabinets and stepped demonstration tables.
      replace(() => cabinet(-1.62,island,1.48,.78,.98,base,white),base);
      cabinet(1.62,island+.32,1.48,.78,.98,base,white);
      box(1.06,1.045,island+.54,.30,.015,.22,0x627452);
      // Separate unprinted AA and eTag forms at their published sizes.
      column(.978,1.078,island+.52,.00725,.0505,0x88a62a);
      column(1.13,1.057,island+.63,.016,.0083,pearl);
      sideShelf(-1,silver,'pack');ringLight(0,mid,1.14,3.69);plant(side-.71,front-1.08,1.47);break;
    case 17: // Gigaset: nested signal arcs, a dark round island and illuminated phone docks.
      for(const x of [-side+.71,side-.71])shelf(x,rear+.24,.99,'pack',charcoal);
      {
        const top = circleIsland(0,island,1.12,.85,base);
        const handsets = [
          {x:-.32, width:.048, height:.159, depth:.030, screen:0xe8a75e, baseWidth:.082},
          {x:.32, width:.055, height:.172, depth:.034, screen:0x6688b1, baseWidth:.151}
        ];
        for (const {x,width,height,depth,screen,baseWidth} of handsets) {
          const front = island+depth/2;
          box(x,top+.013,island,baseWidth,.027,.088,charcoal);
          box(x,top+.026+height/2,island,width,height,depth,0x353d3d);
          box(x,top+.026+height*.72,front+.001,width*.69,height*.235,.002,screen);
          for (let row=0;row<4;row++) for (const col of [-1,0,1]) {
            box(x+col*width*.223,top+.045+row*height*.075,front+.002,width*.15,.006,.004,0x798784);
          }
        }
        for (const dx of [.04,.059]) box(.32+dx,top+.029,island+.014,.013,.006,.013,0x78847d);
      }
      ringLight(0,mid,1.24,3.56);ringLight(0,mid,.72,3.75);plant(-side+.82,front-.8,1.42);break;
  }
}
