/** Apply per-instance visitor choices without changing shared source materials. */
export function createVisitorCustomization(root) {
  const parts = [];
  root.traverse(node => {
    if (node.isMesh && node.name.startsWith('V2_')) parts.push(node);
  });
  const find = prefix => parts.filter(part => part.name.startsWith(prefix));
  const groups = {
    hair: find('V2_hair_').filter(part => !part.name.startsWith('V2_hair_alt_')),
    alternateHair: find('V2_hair_alt_'),
    polo: parts.filter(part => part.name.startsWith('V2_outfit_GJH_') || part.name.startsWith('V2_outfit_Cream_')),
    hoodie: find('V2_outfit_alt_'),
    skin: find('V2_body_Warm_peach_skin'),
    glasses: find('V2_glasses_'),
    backpack: find('V2_backpack_'),
    watch: find('V2_watch_'),
    shoes: find('V2_shoes_'),
  };
  if (Object.values(groups).some(group => group.length === 0))
    throw new Error('Visitor customization components are missing');
  const originals = new Map();
  for (const part of [...groups.hair, ...groups.alternateHair, ...groups.skin, ...groups.shoes]) {
    originals.set(part, part.material);
    part.material = part.material.clone();
  }
  const colors = {light: 0xefb37e, medium: 0xb7774d, dark: 0x75472f};
  const hairColors = {brown: 0x412b1c, black: 0x211e20};
  const shoeColors = {cream: null, black: 0x292c31, brown: 0x805b43};
  let state = {hair: 'swept', hairColor: 'brown', outfit: 'polo', skin: 'light', shoes: 'cream', glasses: true, backpack: true, watch: true};
  const visible = (group, value) => { for (const part of group) part.visible = value; };
  function apply(changes = {}) {
    const next = {...state, ...changes};
    if (!['swept', 'short'].includes(next.hair) || !(next.hairColor in hairColors) ||
        !['polo', 'hoodie'].includes(next.outfit) || !(next.skin in colors) || !Object.hasOwn(shoeColors, next.shoes) ||
        !['glasses', 'backpack', 'watch'].every(key => typeof next[key] === 'boolean'))
      throw new TypeError('Invalid visitor customization');
    visible(groups.hair, next.hair === 'swept');
    visible(groups.alternateHair, next.hair === 'short');
    visible(groups.polo, next.outfit === 'polo');
    visible(groups.hoodie, next.outfit === 'hoodie');
    for (const part of [...groups.hair, ...groups.alternateHair]) part.material.color.setHex(hairColors[next.hairColor]);
    for (const part of groups.skin) part.material.color.setHex(colors[next.skin]);
    for (const part of groups.shoes) {
      if (next.shoes === 'cream') part.material.color.copy(originals.get(part).color);
      else part.material.color.setHex(shoeColors[next.shoes]);
    }
    for (const key of ['glasses', 'backpack', 'watch']) visible(groups[key], next[key]);
    state = next;
    return {...state};
  }
  apply();
  return {
    apply,
    get state() { return {...state}; },
    dispose() {
      for (const [part, original] of originals) {
        part.material.dispose();
        part.material = original;
      }
      originals.clear();
    },
  };
}
