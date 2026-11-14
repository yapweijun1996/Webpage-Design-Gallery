// Conservative bounds for the DOM text flagged as incomplete by axe.
// A WebGL scene can have any pixel colour; translucent HUD backgrounds must
// therefore pass against the entire underlying black-to-white luminance range.
window.gjhContrast = element => {
  const rgba = value => {
    const numbers = value.match(/[\d.]+/g)?.map(Number);
    if (!value.startsWith('rgb') || !numbers || numbers.length < 3) return null;
    return [...numbers.slice(0, 3), numbers[3] ?? 1];
  };
  const luminance = colour => colour.reduce((sum, value, index) => {
    const channel = value / 255;
    return sum + [0.2126, 0.7152, 0.0722][index] *
      (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  }, 0);
  const style = getComputedStyle(element), rect = element.getBoundingClientRect();
  if (style.visibility === 'hidden' || !rect.width || !rect.height) return {hidden: true};
  for (let node = element; node; node = node.parentElement) {
    const computed = getComputedStyle(node);
    if (computed.opacity !== '1' || computed.filter !== 'none' ||
        computed.mixBlendMode !== 'normal' || computed.backdropFilter !== 'none') {
      return {unresolved: 'Ancestor compositing requires rendered review'};
    }
  }
  const foreground = rgba(style.color), layers = [];
  const scene = element.closest('#experience');
  for (let node = element; node; node = node.parentElement) {
    const computed = getComputedStyle(node), colour = rgba(computed.backgroundColor);
    if (!colour || computed.backgroundImage !== 'none') {
      return {unresolved: 'Image, gradient, opacity or unsupported colour requires rendered review'};
    }
    layers.push(colour);
    if (colour[3] === 1 || node === scene) break;
  }
  if (!foreground || foreground[3] !== 1) return {unresolved: 'Non-opaque foreground'};
  let low = [0, 0, 0], high = [255, 255, 255];
  for (const colour of layers.reverse()) {
    low = low.map((value, index) => colour[index] * colour[3] + value * (1 - colour[3]));
    high = high.map((value, index) => colour[index] * colour[3] + value * (1 - colour[3]));
  }
  const foregroundLuminance = luminance(foreground.slice(0, 3));
  const lowLuminance = luminance(low), highLuminance = luminance(high);
  const ratio = background => (Math.max(foregroundLuminance, background) + 0.05) /
    (Math.min(foregroundLuminance, background) + 0.05);
  const minimum = foregroundLuminance >= lowLuminance && foregroundLuminance <= highLuminance
    ? 1 : Math.min(ratio(lowLuminance), ratio(highLuminance));
  return {foreground: style.color, lowBackground: low, highBackground: high,
    minimumRatio: minimum, requiredRatio: 4.5};
};
