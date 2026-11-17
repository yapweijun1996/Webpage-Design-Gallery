// Window scenery is baked into a shared mesh. Dimensions are metres in a bay-local
// frame centred behind the left pane, with positive Z toward the visitor.
export function buildWindowStudio(number, palette, {box, column, disc, bar, arch}, width, centre) {
  const [primary, secondary, light] = palette;
  const brass = 0xba945c, timber = 0x9b7353, black = 0x252b30;
  const backdrop = (colour, floor) => {
    const bay = width - .45, opening = 2.15, wing = (bay-opening)/2;
    // Return the walls into a deep central niche, so the front door has a
    // sightline past both displays. The canopy and reveal catch the overhead light.
    for (const side of [-1,1]) {
      box(centre+side*(opening+wing)/2, 2.35, -1.05, wing, 4.7, .16, colour);
      box(centre+side*opening/2, 2.35, -1.7, .11, 4.7, 1.44, colour);
      box(centre+side*bay/2, 2.35, -.13, .12, 4.7, 2, colour);
    }
    box(centre, 2.35, -2.42, opening, 4.7, .13, colour);
    box(centre, 3.68, -2.29, opening-.09, .075, .16, light);
    box(centre, .09, -.73, bay, .18, 3.44, floor);
    box(centre, 4.61, -.72, bay, .16, 3.4, floor);
  };
  const counter = (x,y,z,w,h,d,colour,top) => {
    box(x,y+h/2,z,w,h,d,colour);
    box(x,y+h+.035,z,w+.12,.07,d+.09,top);
  };
  const bottle = (x,y,z,r,h,body,lid) => {
    column(x,y+h/2,z,r,h,body);
    column(x,y+h+.045,z,r*.85,.09,lid);
  };
  switch (number) {
    case 4: { // Sage dispensary: a rounded niche and a stepped patch-pack display.
      backdrop(primary,light);
      arch(0,.18,-.83,1.33,2.08,.18,light);
      counter(0,.18,.13,2.25,.63,1.0,secondary,light);
      for (let i=0;i<3;i++) {
        const x=(i-1)*.6, y=.89+i*.14;
        box(x,y,.19,.47,.15+i*.26,.48,light);
        box(x,y+.32+i*.13,.18,.39,.51,.12,secondary);
        disc(x,y+.36+i*.13,.252,.095,.03,light);
      }
      break;
    }
    case 5: { // Apothecary specimen cabinet with timber pigeonholes and brass pulls.
      backdrop(secondary,timber);
      box(0,1.42,-.46,2.65,2.46,.65,primary);
      for (let row=0;row<4;row++) for(let col=0;col<4;col++) {
        const x=(col-1.5)*.61,y=.6+row*.52;
        box(x,y,-.08,.55,.45,.14,timber);
        box(x,y+.01,.015,.17,.055,.07,brass);
      }
      for(const x of [-.75,0,.75]) bottle(x,2.68,-.48,.16,.26,light,primary);
      break;
    }
    case 6: { // A pantry stall with a striped valance and stacks of noodle packets.
      backdrop(secondary,light);
      for (let i=0;i<9;i++) box((i-4)*.32,2.82,-.02,.32,.31,.98,i%2?primary:light);
      for(const x of [-1.36,1.36]) column(x,1.65,-.18,.055,2.83,timber);
      counter(0,.18,.06,2.5,.86,.95,timber,primary);
      for(let row=0;row<3;row++) for(let i=0;i<4-row;i++)
        box((i-(3-row)/2)*.47,1.19+row*.21,.16,.43,.19,.39,row%2?light:primary);
      break;
    }
    case 7: { // An open jade market hutch framing a pyramid of preserved-food tins.
      backdrop(primary,light);
      for(const x of [-1.28,1.28]) box(x,1.66,-.19,.13,2.98,.61,timber);
      for(const y of [.55,1.53,2.54]) {
        box(0,y,-.15,2.72,.12,.78,secondary);
        for(let i=-2;i<=2;i++) bottle(i*.44,y+.06,-.04,.16,.33,light,brass);
      }
      break;
    }
    case 8: { // A blue enamel pantry with a large scalloped biscuit-coloured medallion.
      backdrop(primary,secondary);
      for(let i=-2;i<=2;i++) disc(i*.45,2.34+Math.cos(i*.5)*.3,-.82,.47,.09,light);
      counter(0,.18,.08,2.48,.67,1,secondary,light);
      for(let i=-1;i<=1;i++) {
        const rise=i===0?.38:.13;
        column(i*.73,.91+rise/2,.08,.36,rise,light);
        bottle(i*.73,.91+rise,.12,.255,.47,0xc58e52,primary);
      }
      break;
    }
    case 9: { // A navy diner counter: yellow sunburst and square tins in a stepped stack.
      backdrop(primary,light);
      for(let i=-3;i<=3;i++) {
        const angle=i*.35;
        bar(0,1.67,-.81,Math.sin(angle)*1.24,1.67+Math.cos(angle)*1.39,-.81,.075,secondary);
      }
      counter(0,.18,.1,2.6,.77,.94,light,secondary);
      for(let row=0;row<3;row++) for(let i=0;i<3-row;i++) {
        const x=(i-(2-row)/2)*.66,y=1.18+row*.35;
        box(x,y,.13,.61,.32,.35,primary);
        box(x,y+.156,.13,.62,.03,.37,secondary);
      }
      break;
    }
    case 10: { // A pearl shell fan and concentric display dais for the seafood window.
      backdrop(primary,light);
      for(let i=-4;i<=4;i++) {
        const a=i*.30;
        bar(0,.74,-.79,Math.sin(a)*1.28,.74+Math.cos(a)*2.12,-.79,.18,i%2?light:secondary);
      }
      column(0,.39,.02,1.18,.4,light); column(0,.69,.02,.81,.22,secondary);
      bottle(0,.80,.09,.34,.43,light,brass);
      break;
    }
    case 11: { // An industrial pantry: asymmetric steel uprights, open crates and tins.
      backdrop(primary,secondary);
      for(let i=0;i<3;i++) {
        const x=(i-1)*.77,h=.69+i*.57;
        counter(x,.18,.0,.68,h,.75,secondary,light);
        for(let j=-1;j<=1;j++) box(x+j*.18,.18+h/2,.39,.055,h-.1,.045,black);
        bottle(x,h+.27,.06,.21,.34,light,secondary);
      }
      break;
    }
    case 12: { // Cool clinical gallery: a nested arch above a cantilevered sample ledge.
      backdrop(light,secondary);
      arch(0,.19,-.82,1.34,1.68,.15,primary);
      arch(0,.19,-.69,1.06,1.68,.09,secondary);
      box(0,1.02,-.12,2.48,.14,1.28,primary);
      box(-.73,.60,-.22,.42,.84,.74,secondary);
      for(let i=-1;i<=1;i++) {
        box(i*.56,1.42,.14,.39,.64,.22,light);
        box(i*.56,1.5,.268,.29,.13,.024,secondary);
      }
      break;
    }
    case 13: { // Acoustic listening room with a radial soundwave and two speaker towers.
      backdrop(primary,black);
      for(let i=-6;i<=6;i++) {
        const h=.38+1.45*Math.abs(Math.cos(i*.67));
        box(i*.20,2.43,-.85,.087,h,.1,secondary);
      }
      for(const x of [-.83,.83]) {
        box(x,.98,-.12,.66,1.58,.64,black);
        for(const y of [.7,1.33]) disc(x,y,.225,.23,.07,secondary);
      }
      break;
    }
    case 14: { // A tiered cinema installation with a continuous violet horizon across three screens.
      backdrop(light,secondary);
      for(let i=-1;i<=1;i++) {
        const y=1.99+i*.29;
        box(i*.84,y,-.28,.81,1.06,.14,black);
        box(i*.84,y,-.195,.72,.96,.035,primary);
        box(i*.84,1.99,-.166,.72,.075,.02,secondary);
        box(i*.84,(y-.55)/2,-.3,.075,y-.55,.12,black);
      }
      break;
    }
    case 15: { // Walnut recital room: organ-like battens and an open music stand over piano keys.
      backdrop(secondary,primary);
      for(let i=-5;i<=5;i++) {
        const h=1.08+Math.cos(i*.43)*.85;
        box(i*.23,3.42-h/2,-.86,.14,h,.18,timber);
      }
      for(const x of [-.89,.89]) box(x,.68,-.05,.14,.97,.39,primary);
      box(0,1.32,-.07,2.38,.41,.82,primary);
      for(let i=0;i<16;i++) {
        box((i-7.5)*.13,1.41,.40,.12,.09,.34,light);
        if(![2,6].includes(i%7)) box((i-7.0)*.13,1.47,.33,.067,.09,.16,black);
      }
      box(0,1.76,-.06,.82,.43,.085,light);
      break;
    }
    case 16: { // A modular charger wall with a locator puck in a lime bullseye.
      backdrop(secondary,light);
      for(let i=-1;i<=1;i++) for(let j=0;j<3;j++)
        box(i*.76,.86+j*.76,-.62,.69,.69,.22,primary);
      disc(0,1.65,-.37,.57,.12,light);
      disc(0,1.65,-.26,.33,.12,secondary);
      counter(0,.18,.27,1.8,.68,.8,primary,light);
      disc(.0,1.22,.31,.28,.13,primary);
      break;
    }
    case 17: { // Communications atelier: signal rings and a pair of handset docking stations.
      backdrop(primary,light);
      for (const r of [.41,.74,1.07]) arch(0,1.68,-.82,r,.21,.062,secondary);
      for(const x of [-.68,.68]) {
        column(x,.55,.05,.46,.75,secondary);
        box(x,1.02,.05,.55,.16,.48,black);
        box(x,1.43,.08,.34,.83,.15,light);
        box(x,1.64,.171,.23,.2,.03,black);
        for(let j=0;j<3;j++) box(x,1.44-j*.085,.169,.21,.035,.025,secondary);
      }
      break;
    }
  }
}
