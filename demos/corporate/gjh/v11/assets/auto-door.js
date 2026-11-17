// Separate opening and closing distances prevent jitter at the detection edge.
export function shouldOpenStoreDoor(door, player) {
  return player.y < 2 && Math.hypot(player.x-door.x, player.z) < (door.targetOpen ? 5.2 : 4.8);
}
