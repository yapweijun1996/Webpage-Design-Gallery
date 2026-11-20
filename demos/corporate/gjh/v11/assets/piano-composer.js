const MODES = {
  Major: [0,2,4,5,7,9,11],
  Lydian: [0,2,4,6,7,9,11],
  Dorian: [0,2,3,5,7,9,10],
  Pentatonic: [0,2,4,7,9]
};
const KEYS = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const SETTINGS = {
  courtyard: ['Courtyard',66,84],
  newmoon: ['New Moon',58,74],
  upper: ['Upper Level',62,80],
  christmas: ['Christmas',64,82],
  tram: ['Tram',60,78]
};
const PROGRESSIONS = [[0,5,3,4],[1,4,0,0],[3,0,4,5],[0,3,1,4]];
export const BARS_PER_PHRASE = 8;

function randomFrom(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.codePointAt(0), 16777619);
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (items, random) => items[Math.floor(random() * items.length)];
const wrap = (value, size) => ((value % size) + size) % size;
const pitch = (scale, tonic, degree) => tonic + scale[wrap(degree, scale.length)] +
  12 * Math.floor(degree / scale.length);

export function createPianoPiece(seed, setting) {
  const place = Object.hasOwn(SETTINGS, setting) ? setting : 'courtyard';
  const [name, slow, fast] = SETTINGS[place];
  const identity = JSON.stringify([seed, place]);
  const random = randomFrom(identity);
  const key = Math.floor(random() * KEYS.length);
  const mode = pick(Object.keys(MODES), random);
  const bpm = slow + Math.floor(random() * (fast - slow + 1));
  const progression = pick(PROGRESSIONS, random);
  const motif = Array.from({length:4}, () => pick([-2,-1,1,1,2,3], random));
  return {identity,key,mode,bpm,progression,motif,title:`${name} in ${KEYS[key]} ${mode}`};
}

function voice(rhythm, noteAt, velocity, random) {
  let beat = 0;
  return rhythm.map((beats, index) => {
    const note = noteAt(index);
    const event = {beat,beats,note,velocity:velocity * (.84 + random() * .28)};
    beat += beats;
    return event;
  });
}

export function* composePianoBars(piece, index) {
  const random = randomFrom(`${piece.identity}/${index}`);
  const scale = MODES[piece.mode];
  const harmony = piece.mode === 'Pentatonic' ? MODES.Major : scale;
  const inversion = index % 3 === 2 ? -1 : 1;
  const transpose = index % 3 === 1 ? pick([-2,-1,1,2], random) : 0;
  const broken = random() < .5;
  let degree = 2 + transpose;
  for (let bar = 0; bar < BARS_PER_PHRASE; bar++) {
    const chord = piece.progression[bar % piece.progression.length];
    const root = pitch(harmony, 48 + piece.key, chord);
    const bass = root > 59 ? root - 12 : root;
    const third = pitch(harmony, 0, chord + 2) - pitch(harmony, 0, chord);
    const fifth = pitch(harmony, 0, chord + 4) - pitch(harmony, 0, chord);
    const left = broken ? [bass,bass + fifth,bass + 12,bass + third] :
      [bass,bass + fifth,bass + third];
    const bassLine = voice(broken ? [1,1,1,1] : [2,1,1], i => left[i], .25, random);
    // Alternate the opening rhythm so adjacent phrases always differ audibly.
    const rhythm = bar === 0 ? (index % 2 ? [.5,1.5,1,1] : [1.5,.5,1,1]) :
      bar === 7 ? [1,2,1] : pick([[1,1,.5,1.5],[.5,1,1.5,1],[2,1,1]], random);
    const melody = voice(rhythm, i => {
      if ((bar === 7 && i === rhythm.length - 1) || (i > 0 && random() < .14)) return null;
      if (bar === 7 && i === 1) degree = 0;
      else if (bar || i) {
        const motion = random() < .82 ? piece.motif[(bar + i) % piece.motif.length] : pick([-4,-3,3,4], random);
        const next = degree + inversion * motion;
        degree = next < -2 || next > 9 ? degree - inversion * motion : next;
        degree = Math.max(-2, Math.min(9, degree));
      }
      return pitch(scale, 60 + piece.key, degree);
    }, .34, random);
    yield {beats:4,bass:bassLine,melody};
  }
}

export function composePianoPhrase(piece, index) {
  return Array.from(composePianoBars(piece, index));
}
