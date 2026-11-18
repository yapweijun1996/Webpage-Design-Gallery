// Reference ink heights from tests/measure_gjh_signage.mjs at 12 m, front-on.
// These are measurements of the CPU proof on macOS, independent of live FPS.
const samples = [
  ['S01',17,17,17], ['S02',10,12,12], ['S03',16,16,16], ['S04',6,13,12],
  ['S05',8,11,11], ['S06',12,12,12], ['S07',13,13,13], ['S08',15,15,15],
  ['S09',19,19,19], ['S10',7,12,12], ['S11',14,13,13], ['S12',13,13,13],
  ['S13',28,28,27], ['S14',19,20,20], ['S15',24,24,24], ['S16',7,11,11],
  ['S17',17,17,17]
];

export function phoneProof(tier) {
  return {
    canvasCssPx:[393,550], distanceM:12, verticalFovDeg:77.876,
    glyphs:Object.fromEntries(samples.map(([id,previous,low,full]) =>
      [id,{previousCssPx:previous,activeAtlasCssPx:tier==='low'?low:full}]))
  };
}
