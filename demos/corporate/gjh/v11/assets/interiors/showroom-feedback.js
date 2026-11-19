// The installer shares its single unlit mesh and geometry cache with the pilot rooms.
export function createShowroomFeedback(T, shapes, merge) {
  const box = (...size) => new T.BoxGeometry(...size);
  const hoop = () => new T.TorusGeometry(.41,.065,5,16);
  Object.assign(shapes, {
    pearl: () => new T.SphereGeometry(.5,10,6),
    wheel: () => merge([hoop(), box(.82,.065,.07), box(.065,.82,.07)]),
    swirl: () => new T.TorusGeometry(.34,.12,4,16,Math.PI*1.85).rotateX(-Math.PI/2),
    waveform: () => merge([.25,.64,1,.5,.32].map((h,i) => box(.12,h,.12).translate((i-2)*.2,0,0))),
    receiver: () => merge([box(.75,.2,.28), ...[-.4,.4].map(x => box(.22,.35,.4).translate(x,-.08,0))]),
    leaves: () => merge([-.22,.22].map(x => new T.SphereGeometry(.5,8,4)
      .scale(.45,.85,.12).rotateZ(-Math.sign(x)*.48).translate(x,0,0))),
    bars: () => merge([.36,.66,.96].map((h,i) => box(.22,h,.1).translate((i-1)*.33,h/2-.5,0)))
  });
  let audio, muted = false;
  const alternate = new Map();
  function begin({id,shopAction}) {
    const {effect,duration} = shopAction;
    if (effect === 'try' || effect === 'torch') {
      const previous = alternate.get(id);
      alternate.set(id,!previous);
      return () => alternate.set(id,previous);
    }
    if (effect === 'mute') {
      muted = !muted;
      shopAction.done = muted ? 'Demo audio muted.' : 'Demo audio enabled.';
      return () => { muted = !muted; };
    }
    if (!['listen','play','ring'].includes(effect) || muted || !globalThis.AudioContext) return;
    // Allocate and unlock only on the visitor's F/touch gesture.
    try {
      audio ??= new globalThis.AudioContext();
      if (audio.state === 'suspended') void audio.resume().catch(() => {});
      const tone = audio.createOscillator(), volume = audio.createGain();
      const start = audio.currentTime;
      const notes = effect === 'ring' ? [660,880] : [261.63,329.63,392];
      notes.forEach((hz,i) => tone.frequency.setValueAtTime(hz,start+i*duration/notes.length));
      volume.gain.setValueAtTime(0,start);
      volume.gain.linearRampToValueAtTime(.045,start+.015);
      volume.gain.exponentialRampToValueAtTime(.0001,start+duration);
      tone.connect(volume);
      volume.connect(audio.destination);
      tone.onended = () => { tone.disconnect(); volume.disconnect(); };
      tone.start(start);
      tone.stop(start+duration);
      return () => tone.stop();
    } catch { /* Visual feedback also runs when the device declines audio. */ }
  }
  function present(target,t,draw) {
    const {item,effect} = target.shopAction;
    const dx = target.standing.x-target.x, dz = target.standing.z-target.z;
    const angle = Math.atan2(dx,dz);
    const localAngle = Math.atan2(item.standing[0]-item.xyz[0],item.standing[1]-item.xyz[2])
      - item.yawDeg*Math.PI/180;
    const edge = Math.min(item.size[0]/(2*Math.abs(Math.sin(localAngle))),
      item.size[2]/(2*Math.abs(Math.cos(localAngle))))+.06;
    const height = target.y-item.size[1]+Math.min(1.18,item.size[1]*.72);
    const peak = Math.sin(Math.PI*t);
    const gold = 0xe7ae51, green = 0x61d7a4, cream = 0xffe9bd;
    function show(shape,color,size,x=0,y=0,z=0,tilt=0,turn=0) {
      const sin = Math.sin(angle), cos = Math.cos(angle);
      draw([target.x+sin*(edge+z)+cos*x,height+y,target.z+cos*(edge+z)-sin*x],
        angle+turn,shape,color,size,tilt);
    }
    switch (effect) {
      case 'leaf': return show('box',cream,[.38,.32,.025],.11*t,.08,0,0,-1.3*t);
      case 'open': return show('box',0xb6d3d1,[.36,.48,.045],.16*t,.05,.12*t,0,-1.1*t);
      case 'drawer': return show('drawer',0xb76545,[.55,.18,.28],0,0,.15*t);
      case 'spin': return show('wheel',gold,[.42,.42,.16],0,.08,0,t*Math.PI*1.25);
      case 'plate': return show('disc',gold,[.32,.09,.25],0,.12*peak);
      case 'sample': return show('disc',0xda6555,[.19,.27,.19],0,.2*t);
      case 'lid': return show('disc',0x416bba,[.35,.07,.35],0,.25*t,0,.5*t);
      case 'spread': return show('swirl',0xca803c,[.12+.28*t,.22,.12+.28*t],.08*t,.08);
      case 'scan': return show('box',t<.85?0xff6655:green,[.36,.035,.07],0,.25*peak);
      case 'press': return show('disc',t<.25?gold:green,[.19,.085,.19],0,-.06*peak);
      case 'pearl': return t<.45 ? show('disc',0xe8bea5,[.43,.09,.32],0,.2*t,0,-1.8*t)
        : show('pearl',0xfff5d9,[.19,.19,.19],0,.18*t);
      case 'unbox': return t<.55 ? show('box',gold,[.4,.04,.3],.12*t,.28*t,0,.9*t)
        : show('disc',0xc87861,[.27,.14,.19],0,.12);
      case 'pair': return show('leaves',t<.6?gold:green,[.42,.4,.2],.15*(1-t),.06);
      case 'listen': return show('waveform',green,[.45,.16+.24*Math.abs(Math.sin(t*12)),.2]);
      case 'play': return show('box',gold,[.105,.06,.23],(Math.min(2,Math.floor(t*3))-1)*.13,-.035*peak);
      case 'try': return show(alternate.get(target.id)?'bars':'waveform',alternate.get(target.id)?green:gold,
        [.88,.44,.15],0,.03*peak);
      case 'torch': return show('pearl',alternate.get(target.id)?0xffea88:0x54626b,[.18,.18,.18],0,.04*peak);
      case 'meter': return show('bars',green,[.34,.12+.09*Math.min(3,Math.floor(t*4)),.18]);
      case 'ring': return show('receiver',0x86c6d3,[.35,.28,.26],0,.24*t,0,.35*t);
      case 'water': return show('disc',0x71cede,[.065,.09+.18*peak,.065],0,.22*(1-t));
      case 'mute': return show('waveform',muted?0xa1a7ac:green,[.34,muted?.08:.3,.15]);
    }
  }
  return {begin,present};
}
