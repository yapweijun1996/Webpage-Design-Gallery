'use strict';

// Eight-digit hex uses CSS alpha. A translucent background is composited over a white canvas.

const HEX_COLOR = /^#?([a-f0-9]{3}|[a-f0-9]{6}|[a-f0-9]{8})$/i;
const WHITE = [1, 1, 1];
const RATINGS = [
  ['AA normal', 4.5],
  ['AA large', 3],
  ['AAA normal', 7],
  ['AAA large', 4.5],
];

function parseHex(input, name) {
  const match = typeof input === 'string' && input.trim().match(HEX_COLOR);
  if (!match) {
    throw new Error(`Invalid ${name} color ${JSON.stringify(input)}. Use 3, 6, or 8 hex digits with an optional #.`);
  }
  const digits = match[1];
  const pairs = digits.length === 3 ? [...digits].map(digit => digit.repeat(2)) : digits.match(/../g);
  const [red, green, blue, alpha = 1] = pairs.map(pair => Number.parseInt(pair, 16) / 255);
  return [red, green, blue, alpha];
}

function composite([red, green, blue, alpha], background) {
  return [red, green, blue].map((channel, index) => channel * alpha + background[index] * (1 - alpha));
}

function luminance(rgb) {
  const [red, green, blue] = rgb.map(channel =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground, background) {
  const front = parseHex(foreground, 'foreground');
  const back = composite(parseHex(background, 'background'), WHITE);
  const frontLuminance = luminance(composite(front, back));
  const backLuminance = luminance(back);
  return (Math.max(frontLuminance, backLuminance) + 0.05) /
    (Math.min(frontLuminance, backLuminance) + 0.05);
}

if (require.main === module) {
  const colors = process.argv.slice(2);
  try {
    if (colors.length !== 2) throw new Error('Usage: node swarm/tools/contrast.js <fg> <bg>');
    const ratio = contrastRatio(...colors);
    console.log(`Contrast ratio: ${ratio.toFixed(2)}:1`);
    for (const [name, threshold] of RATINGS) {
      console.log(`${name} (${threshold}): ${ratio >= threshold ? 'PASS' : 'FAIL'}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { contrastRatio };
