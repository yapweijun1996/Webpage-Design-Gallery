// Walkable rooms based on the fourteen shopfront references.
// Positive Z faces the arcade. Every bay keeps a clear sightline to its rear wall.
const cream=0xf3e5cd, pearl=0xfff3df, brass=0xcaa15b, oak=0xb18356, walnut=0x66412f;
const sage=0x76846a, charcoal=0x2d3032, silver=0xc4c3bd, white=0xf7f4e9;
// Keeping the centre fixtures behind the threshold leaves a turning area in
// front and two routes around each island. Countertop GLBs use this same datum.
export const shopIslandZ = -.63;
export const shopLamp = 0xffe6a7;
const finishes = {
  4:[0xe2cfad,0xa77d82,0xf0dfc7],5:[0x69442c,0x8b5a38,0xe3c79c],
  6:[0xb28a5c,0xc59d69,0xead5b8],7:[0x762f26,0x8e4d35,0xb58b64],
  8:[0xeee4c9,0x213969,0xf4e9d3],9:[0x273849,0x1d324e,0xc2ae8e],
  10:[0xacc3ac,0x728c78,0xf2e7cf],11:[0x75423a,0x88423c,0xe4d4b6],
  12:[0xe9e9da,0xb1c5a7,0xece9d8],13:[0x66482f,0x363637,0xae9f87],
  14:[0xe3cfb5,0xccb394,0xeee4d7],15:[0x604534,0x694635,0x9c7e61],
  16:[0xf1f1de,0xb1c02f,0xf1efdf],17:[0xaa8464,0x433c39,0xdcc5a8]
};

export function buildWindowStudio(n, t, width, depth) {
  const {box, column, disc, bar, arch, ring, ellipse, tapered, block} = t;
  const [wall, base, floor] = finishes[n];
  const back=-depth/2+.38, front=depth/2-.18, side=width/2-.23, span=front-back, mid=(front+back)/2;
  const cabinet = (x,z,w,h,d,body,cap) => {
    block(x,(h+.26)/2,z,w+.09,h+.26,d+.09);
    box(x,.12,z,w-.1,.23,d-.1,brass);
    box(x,.18+h/2,z,w,h,d,body);
    box(x,.21+h,z,w+.09,.095,d+.09,cap);
  };
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
  function packageRow(x,y,z,count,step,kind,c) {
    for(let j=0;j<count;j++) {
      const px=x+(j-(count-1)/2)*step;
      if(kind==='tin') can(px,y,z,j%3===0?cream:c);
      else {
        const h=kind==='pack'?.31:.24;
        box(px,y+h/2,z,.18,h,.13,j%3===0?pearl:c);
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
      box(x,h-.04,z+.46,w-.05,.035,.035,shopLamp);
      packageRow(x,h+.05,z+.28,Math.floor(w/.27),.25,kind,c);
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
        if(kind==='tin') can(x-s*.19,y+.05,z,i%3?cream:base,.10,.21);
        else box(x-s*.19,y+.19,z,.14,.28,.20,i%3?white:base);
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
  function screen(x,y,z,w,h) {
    box(x,y,z,w,h,.10,charcoal);
    // A landscape of receding coloured ridge lines reads as a lit TV from the arcade.
    box(x,y,z+.06,w-.09,h-.09,.018,0x677ea1);
    box(x,y-h*.28,z+.078,w-.1,h*.3,.018,0x4d646d);
    for(const [a,b,e,f] of [[-.47,-.12,-.12,.12],[-.12,.12,.1,-.07],[.1,-.07,.37,.05],[.37,.05,.46,-.06]])
      bar(x+a*w,y+b*h,z+.095,x+e*w,y+f*h,z+.095,.039,0xe8ad9c);
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
  box(0,.041,mid,side*2,.08,span,floor);
  box(0,2.12,back,side*2,4.18,.13,wall);
  box(0,4.19,mid,side*2,.18,span,cream);
  for(const s of [-1,1]) {
    box(s*side,2.10,mid,.13,4.13,span,wall);
    box(s*(side-.31),4.05,mid,.065,.046,span-.6,shopLamp);
    box(s*(side-.2),.19,mid,.15,.21,span,base);
  }
  for(const z of [back+.38,front-.46]) box(0,4.04,z,width-.9,.045,.08,shopLamp);
  for(const x of [-side*.64,0,side*.64])for(const z of [back+1.3,mid+.25,front-1.13])
    column(x,4.076,z,.078,.045,shopLamp);
  for(let z=back+1;z<front;z+=1.12)box(0,.086,z,side*2-.1,.008,.014,0xb5a693);
  if(n<13 && n!==10) {
    sideShelf(-1,n===5?walnut:oak,n===4||n===6||n===12?'pack':'tin');
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
    case 4: // Borsch Med: dusty rose fluted counter, white bottles and sage dispensary wall.
      for(let i=-1;i<=1;i++)shelf(i*1.86,rear,1.75,'pack',sage);
      cabinet(-.58,island,2.85,1.03,1.27,base,pearl);
      for(let i=-11;i<=11;i++)box(-.58+i*.117,.69,island+.65,.022,.89,.04,0xcc9e9c);
      for(const x of [-1.19,-.88,-.54,.22])can(x,1.33,island,white,.12,.32);
      pendant(-.9,island,2.9,.42,white); plant(side-.96,front-.74,1.6); break;
    case 5: // Pien Tze Huang: dark timber apothecary, specimen drawers and paper lanterns.
      for(let s=-1;s<=1;s++)shelf(s*2.1,rear,1.88,'tin',0xd1ad81);
      block(-side+1.51,1,mid-1,2.13,2,.4);
      for(let i=0;i<5;i++)for(let j=0;j<4;j++){
        const x=-side+.65+i*.43,y=.43+j*.40;
        box(x,y,mid-1,.39,.36,.35,walnut);disc(x,y,mid-.807,.043,.03,brass);
      }
      cabinet(0,island,2.5,.99,1.24,walnut,oak);plant(-.65,island,1.8);
      for(const z of [mid-1.3,mid+.3,mid+2])pendant(.22,z,3.13,.37,0xf3d099);break;
    case 6: // Flying Wheel: wood transoms and a bank of hanging dried noodles.
      for(let i=-1;i<=1;i++)shelf(i*1.98,rear,1.85,'pack',0xcb9f67);
      cabinet(-.36,island,2.78,.92,1.26,oak,cream);
      for(let i=-9;i<=9;i++){
        const x=-.36+i*.12;
        box(x,2.48+(i%3)*.04,island-.15,.075,.94+(i%4)*.04,.08,0xe2bb76);
      }
      box(-.36,3.03,island-.15,2.5,.095,.12,walnut);
      for(let z=back+.8;z<front;z+=1.36)box(0,3.96,z,side*2,.12,.15,oak);
      packageRow(-.36,1.21,island+.29,7,.32,'pack',oak); break;
    case 7: // Gu Long: lacquer-red arched provision cases and brass tiers.
      for(let i=-1;i<=1;i++)shelf(i*1.93,rear,1.79,'tin',0xa74632,true);
      for(const x of [-1,1])pendant(x,mid+1.2,2.91,.34,brass);
      ringLight(0,mid-.38,.72,3.34);ringLight(0,mid-.38,.45,3.17);
      {const top=circleIsland(0,island,1.14,.82,walnut);
       column(0,top+.13,island,.72,.26,brass);
       for(let i=-2;i<=2;i++)can(i*.24,top+.27,island,0xaa4638);}
      break;
    case 8: // Skippy: checkerboard floor, cobalt fluting, cream niches and domed lights.
      for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++)if((x+z)%2===0)
        box(x*.79,.092,mid+z*.79,.785,.012,.785,0x284271);
      for(let i=-1;i<=1;i++)shelf(i*1.86,rear,1.62,'tin',0x466c9b,true);
      {const top=circleIsland(0,island,1.08,.85,base);for(let i=-2;i<=2;i++)can(i*.28,top,island,0xd2a66c,.12,.33);}
      for(const x of [-1.83,0,1.83])pendant(x,mid+.2,3.1,.45,cream);break;
    case 9: // SPAM: golden sun-shaped niche in navy, striped yellow trim and a curved counter.
      disc(0,1.68,rear+.06,1.56,.13,0xdba735);
      for(let k=0;k<3;k++){const w=2.48-.43*k;box(0,.85+k*.52,rear+.36,w,.08,.43,brass);packageRow(0,.91+k*.52,rear+.36,7-2*k,.28,'pack',cream);}
      cabinet(-.48,island,2.58,.87,1.13,base,cream);
      for(const y of [.28,.98])box(-.48,y,island+.59,2.55,.05,.04,brass);
      pendant(-.5,mid+.25,3,.52,brass);plant(side-1.15,rear+1.31,1.78);break;
    case 10: // California Mexico: pearl shell fans, green stone and tiered seafood islands.
      for(const s of [-1,1]) {
        const x=s*(side-1),z=front-1.5;
        shellFan(x,.62,z,1.97);
        shellFan(x+s*.31,.56,z+.29,1.0);
        circleIsland(x,z+.05,.65,.53,base);
        shelf(s*2.1,rear,1.58,'tin',sage,true);
      }
      for(let i=0;i<3;i++) {
        for(let j=0;j<18;j++){
          const u=j/18,v=(j+1)/18,y=.73+i*.52;
          bar((u-.5)*3.8,y+.23*Math.sin(u*8),rear+.1,(v-.5)*3.8,y+.23*Math.sin(v*8),rear+.1,.048,pearl);
        }
      }
      {const top=circleIsland(0,island,1.2,.79,base);for(let j=-2;j<=2;j++)can(j*.28,top,island,cream);}
      for(let i=0;i<7;i++)pendant(Math.sin(i*2.4)*.56,mid+Math.cos(i*2.4)*.46,2.93+i*.09,.15,pearl);break;
    case 11: // Hormel: a working pantry table, open produce crates and burgundy can shelves.
      for(let i=-1;i<=1;i++)shelf(i*1.83,rear,1.73,'tin',0x8a3e3e);
      block(0,.58,island,2.74,1.16,1.24);
      for(const x of [-1.21,1.21])for(const dz of [-.46,.46])box(x,.60,island+dz,.14,1.05,.14,walnut);
      box(0,1.08,island,2.74,.17,1.24,oak);
      for(const x of [-.75,0,.75]){
        box(x,.39,island,.64,.46,.62,oak);
        for(let j=-1;j<=1;j++)ellipse(x+j*.17,1.27,island,.10,.12,.10,j%2?sage:0xab5d41,0,0);
      }
      pendant(-.69,mid,3,.38,base);pendant(.69,mid,3,.38,base);break;
    case 12: // Zeria: light mint shelving, layered white islands and a planted clinical interior.
      for(const x of [-2.2,2.2])shelf(x,rear,1.43,'pack',base,true);
      for(let i=0;i<3;i++) for(let j=0;j<18;j++){
        const u=j/18,v=(j+1)/18,y=1.15+i*.52;
        bar((u-.5)*3.42,y+.28*Math.sin(u*7+i*.47),rear+.17,(v-.5)*3.42,y+.28*Math.sin(v*7+i*.47),rear+.17,.06,shopLamp);
      }
      {const top=circleIsland(0,island,1.10,.72,white);packageRow(0,top,island,5,.27,'pack',base);}
      for(const x of [-side+.88,side-.88])plant(x,front-.87,1.64);
      ringLight(0,mid,1.38,3.76);break;
    case 13: // Sony: slatted timber listening lounge, dark screen and contrasting upholstered seating.
      for(let i=-15;i<=15;i++)box(i*.185,1.95,rear,.085,3.67,.12,i%3?walnut:oak);
      screen(0,2.14,rear+.23,2.33,1.34);sofa(-1.46,island,0xa49784);sofa(.44,mid-1.66,0x786b5f);
      circleIsland(.68,island+.48,.39,.32,walnut);
      for(const x of [-2.5,2.5]){block(x,1.09,rear+.58,.46,1.99,.5);box(x,1.09,rear+.58,.43,1.99,.44,charcoal);for(const y of [.72,1.41])disc(x,y,rear+.826,.135,.036,silver);}
      ringLight(0,mid+.06,1.12,3.69);plant(-side+.7,front-.85,1.53);
      for(const s of [-1,1]) {
        cabinet(s*(side-.65),mid,.65,.72,2.8,walnut,base);
        for(let i=0;i<3;i++) box(s*(side-.72),1.19,mid+(i-1)*.92,.28,.48,.30,charcoal);
      }
      break;
    case 14: // LG: side-by-side picture walls, ivory sofa, satin appliances and a halo light.
      for(const x of [-1.36,1.36]){arch(x,.21,rear+.11,1.13,1.98,.12,shopLamp);screen(x,1.91,rear+.3,1.95,1.14);}
      sofa(-.86,mid,cream);circleIsland(.71,island,.52,.37,oak);ringLight(0,mid,1.38,3.72);
      for(const x of [-side+.61,-side+1.30]){
        block(x,1.24,mid+1,.62,2.23,.66);
        box(x,1.24,mid+1,.61,2.23,.64,silver);box(x,1.44,mid+1.34,.49,.035,.04,charcoal);
      }
      plant(-side+.81,front-.85,1.61);break;
    case 15: // Casio: walnut slatted ceiling, instrument gallery and bench.
      for(let i=-17;i<=17;i++)box(i*.19,3.98,mid,.078,.19,span-.28,walnut);
      for(let i=-15;i<=15;i++)box(i*.19,1.96,rear,.065,3.61,.13,oak);
      cabinet(-1.05,mid-.59,1.78,.9,1.11,walnut,oak);
      block(1.1,.65,mid-.9,1.64,1.29,.92);
      block(1.10,.34,mid+.16,1.01,.70,.50);
      for(const x of [.46,1.73])box(x,.51,mid-.87,.13,.84,.13,charcoal);
      box(1.1,1.1,mid-.93,1.63,.36,.72,charcoal);
      for(let i=0;i<19;i++)box(.38+i*.08,1.2,mid-.51,.074,.05,.25,pearl);
      box(1.10,.61,mid+.16,.99,.16,.49,charcoal);
      for(const x of [.74,1.46])box(x,.33,mid+.16,.08,.48,.36,walnut);
      pendant(-1.36,mid-1.3,2.94,.26,brass);break;
    case 16: // GP: white modular product wall, lime base cabinets and stepped demonstration tables.
      for(let i=-2;i<=2;i++){
        const x=i*1.02;
        box(x,1.77,rear, .94,2.78,.17,white);
        for(let j=0;j<4;j++)packageRow(x,.66+j*.56,rear+.15,3,.22,'pack',base);
      }
      for(const x of [-1.62,1.62]){
        cabinet(x,island+(x>0?.32:0),1.48,.78,.98,base,white);
        packageRow(x,1.09,island+.03,4,.25,'pack',white);
      }
      sideShelf(-1,silver,'pack');ringLight(0,mid,1.14,3.69);plant(side-.71,front-1.08,1.47);break;
    case 17: // Gigaset: nested signal arcs, a dark round island and illuminated phone docks.
      box(0,1.99,rear,4.8,3.84,.20,0x4c433b);
      for(const r of [.63,.96,1.29,1.62])arch(0,.45,rear+.16,r,.67,.055,brass);
      for(const x of [-side+.71,side-.71])shelf(x,rear+.24,.99,'pack',charcoal);
      {const top=circleIsland(0,island,1.12,.85,base);for(const x of [-.54,0,.54]){
        box(x,top+.04,island,.25,.09,.22,charcoal);box(x,top+.25,island-.02,.15,.38,.077,silver);
      }}
      ringLight(0,mid,1.24,3.56);ringLight(0,mid,.72,3.75);plant(-side+.82,front-.8,1.42);break;
  }
}
