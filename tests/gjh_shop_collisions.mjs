// Physically approach both panes and the front display fixture from the open aisle.
export function checkShopCollisions(win, number) {
  const mall = win.__mall;
  const id = 'planned-space-' + String(number).padStart(2, '0');
  const north = number <= 5, west = number >= 6 && number <= 11;
  const depth = state => north ? -state.z : west ? -15-state.x : state.x-35;
  const along = state => north ? state.x : west ? -state.z : state.z;
  function move(forward, right, ms) {
    mall.setInput({forward, right, run:false});
    return mall.step(ms);
  }
  function check(condition, message) {
    if (!condition) throw Error(id + ' ' + message);
  }
  try {
    for (const direction of [-1, 1]) {
      check(mall.teleport(id), 'missing landing');
      const start = along(mall.state);
      const shifted = move(0, direction, 940);
      check((along(shifted)-start)*direction > 2.1, 'window approach obstructed');
      const contact = depth(move(1, 0, 1450));
      check(contact < -.2 && contact > -.85, 'unexpected window contact depth ' + contact);
      check(Math.abs(depth(move(1, 0, 330))-contact) < .035, 'walked through the pane');
    }
    mall.teleport(id);
    const start = along(mall.state);
    move(0, 0, 500);
    const interior = move(1, 0, 1300);
    check(depth(interior) > .67 && depth(interior) < 1.4, 'front fixture approach depth ' + depth(interior));
    const contact = along(move(0, 1, 1120))-start;
    // Podium centred at +3.0m (north) or +2.55m (other wings).
    const expected = (north ? 3 : 2.55) - 1.09 - .3;
    check(Math.abs(contact-expected)<.12, 'unexpected podium contact ' + contact);
    check(Math.abs(along(move(0, 1, 330))-start-contact) < .035, 'walked through the podium');
    return {number, windows:2, podiumContact:contact};
  } finally {
    mall.setInput(null);
  }
}
