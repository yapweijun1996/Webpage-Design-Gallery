// Permanent finishes belong to normal scene traversal. Detached tier upgrades
// go through the shared RAF uploader before they become eligible to draw.
export function prepareInteriorKit(prepareModel, model, priority, signal) {
  return prepareModel(model, {priority,signal});
}
