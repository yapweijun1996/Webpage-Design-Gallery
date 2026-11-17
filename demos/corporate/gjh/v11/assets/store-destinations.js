import {spatial} from './spatial.js';
import {plannedSpaces} from './expanded-layout.js';

export function storeDestinations(expanded, root = document) {
  if (!expanded) return spatial.stores;
  return [...spatial.stores, ...plannedSpaces.map(space => ({
    ...space, label: root.getElementById(space.id).dataset.plannedBrand
  }))];
}
