// The existing help panel owns focus, scrolling and mobile pause behavior.
export function installVisitorV2Controls(parent, apply) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'visitor-v2-controls';
  const legend = document.createElement('legend'); legend.textContent = 'Visitor appearance · Preview'; fieldset.append(legend);
  const note = document.createElement('p'); note.textContent = 'Choices last for this visit. Close this panel to see changes on compact screens.'; fieldset.append(note);
  const fields = [
    ['hair', 'Hair', [['swept','Swept'],['short','Short']]],
    ['hairColor', 'Hair colour', [['brown','Brown'],['black','Black']]],
    ['outfit', 'Top', [['polo','Polo'],['hoodie','Hoodie']]],
    ['skin', 'Skin tone', [['light','Light'],['medium','Medium'],['dark','Dark']]],
    ['glasses', 'Glasses', [['true','On'],['false','Off']]],
    ['backpack', 'Backpack', [['true','On'],['false','Off']]],
    ['watch', 'Watch', [['true','On'],['false','Off']]],
  ];
  for (const [key, title, choices] of fields) {
    const label = document.createElement('label'), text = document.createElement('span'), select = document.createElement('select');
    text.textContent = title; select.name = key;
    for (const [value, name] of choices) select.add(new Option(name, value));
    select.addEventListener('change', () => apply({[key]: ['glasses','backpack','watch'].includes(key) ? select.value === 'true' : select.value}));
    label.append(text, select); fieldset.append(label);
  }
  parent.append(fieldset);
}
