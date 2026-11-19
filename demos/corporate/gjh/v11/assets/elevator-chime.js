// Unlock on the Ride gesture. Play once when the simulation reaches the stop,
// so pausing the mall also pauses the countdown to the arrival sound.
export function createArrivalChime() {
  let context, bell;
  return {
    unlock() {
      if (!globalThis.AudioContext) return;
      try {
        context ??= new AudioContext();
        if (!bell) {
          bell=context.createBuffer(1,Math.ceil(context.sampleRate*.52),context.sampleRate);
          const samples=bell.getChannelData(0);
          const note=(hz,age)=>age<0 ? 0 : Math.min(1,age/.008)*Math.exp(-age*10)*Math.sin(2*Math.PI*hz*age);
          for (let i=0;i<samples.length;i++) {
            const t=i/context.sampleRate, tail=Math.min(1,(samples.length-i)/(context.sampleRate*.04));
            samples[i]=.095*tail*(note(784,t)+note(1046.5,t-.115));
          }
        }
        if (context.state==='suspended') void context.resume().catch(()=>{});
      } catch { /* Visual arrival remains available with audio disabled. */ }
    },
    play() {
      if (context?.state!=='running' || !bell) return;
      const source=context.createBufferSource();
      source.buffer=bell; source.connect(context.destination); source.start();
    },
    dispose(){if(context)void context.close().catch(()=>{});}
  };
}
