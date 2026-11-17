const storageKey = 'gjh-v11-visitor-appearance';
const booleanFields = ['glasses', 'backpack', 'watch'];
const fields = [
  ['hair', 'Hair', [['swept','Swept'],['short','Short']]],
  ['hairColor', 'Hair colour', [['brown','Brown'],['black','Black']]],
  ['outfit', 'Top', [['polo','Polo'],['hoodie','Hoodie']]],
  ['skin', 'Skin tone', [['light','Light'],['medium','Medium'],['dark','Dark']]],
  ['shoes', 'Shoes', [['cream','Cream'],['black','Black'],['brown','Brown']]],
  ['glasses', 'Glasses', [['true','On'],['false','Off']]],
  ['backpack', 'Backpack', [['true','On'],['false','Off']]],
  ['watch', 'Watch', [['true','On'],['false','Off']]],
];
const storage = () => globalThis.localStorage;

export function readVisitorAppearance(getStorage = storage) {
  try {
    const saved = JSON.parse(getStorage().getItem(storageKey));
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    const result = {};
    for (const [key, , choices] of fields) {
      const value = saved[key];
      if (booleanFields.includes(key) ? typeof value === 'boolean' : choices.some(([choice]) => choice === value)) result[key] = value;
    }
    return result;
  } catch { return {}; }
}

export function saveVisitorAppearance(appearance, getStorage = storage) {
  try { getStorage().setItem(storageKey, JSON.stringify(appearance)); } catch { /* Storage is optional. */ }
}

// The existing help panel owns focus, scrolling and mobile pause behavior.
export function installVisitorV2Controls(parent, apply) {
  function revealFocused(select) {
    if (document.activeElement !== select || !parent.getClientRects().length) return;
    const bounds = select.getBoundingClientRect(), viewport = parent.getBoundingClientRect(), margin = 4;
    if (bounds.top < viewport.top + margin) parent.scrollTop -= viewport.top + margin - bounds.top;
    else if (bounds.bottom > viewport.bottom - margin) parent.scrollTop += bounds.bottom - viewport.bottom + margin;
  }
  function retainVisibleFocus(select) {
    revealFocused(select);
    // Native select menus can finish their own scroll after the change event.
    requestAnimationFrame(() => revealFocused(select));
  }
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'visitor-v2-controls';
  const legend = document.createElement('legend'); legend.textContent = 'Visitor appearance · Preview'; fieldset.append(legend);
  const note = document.createElement('p'); note.textContent = 'Choices are saved on this device when storage is available. Close this panel to see changes on compact screens.'; fieldset.append(note);
  const appearance = readVisitorAppearance();
  if (Object.keys(appearance).length) apply(appearance);
  for (const [key, title, choices] of fields) {
    const label = document.createElement('label'), text = document.createElement('span'), select = document.createElement('select');
    text.textContent = title; select.name = key;
    for (const [value, name] of choices) select.add(new Option(name, value));
    if (Object.hasOwn(appearance, key)) select.value = String(appearance[key]);
    select.addEventListener('focus', () => retainVisibleFocus(select));
    select.addEventListener('change', () => {
      const value = booleanFields.includes(key) ? select.value === 'true' : select.value;
      apply({[key]: value});
      appearance[key] = value;
      saveVisitorAppearance(appearance);
      retainVisibleFocus(select);
    });
    label.append(text, select); fieldset.append(label);
  }
  parent.append(fieldset);
}
