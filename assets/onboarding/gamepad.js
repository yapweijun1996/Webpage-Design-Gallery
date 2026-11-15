/** Called by the host's existing frame loop; this module never schedules frames. */
export function readStandardGamepad() {
  const pads = navigator.getGamepads?.() || [];
  return [...pads].find(pad => pad?.connected && pad.mapping === 'standard') || null;
}
export function gamepadMotion(pad) {
  const axis = index => { const value = Number(pad?.axes[index]) || 0; return Math.abs(value) < .18 ? 0 : Math.sign(value) * Math.min(1,(Math.abs(value)-.18)/.82); };
  return {forward:-axis(1),right:axis(0),lookX:axis(2),lookY:axis(3),run:Boolean(pad?.buttons[10]?.pressed)};
}
