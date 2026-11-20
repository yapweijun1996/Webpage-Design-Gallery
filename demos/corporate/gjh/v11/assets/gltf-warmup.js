// parseAsync alone drains glTF dependencies in microtasks. Start the parse
// and dispatch each mesh or animation through the existing frame budget.
export async function parseWarmGLTF(loader, buffer, path, waitForSlice, signal) {
  if (!waitForSlice) return loader.parseAsync(buffer, path);

  await waitForSlice(signal);
  const split = parser => {
    for (const method of ['loadMesh', 'loadAnimation']) {
      const load = parser[method].bind(parser);
      parser[method] = async index => {
        await waitForSlice(signal);
        return load(index);
      };
    }
    return {name:'GJH_warm_parse'};
  };
  // parseAsync registers plugins synchronously on a fresh parser. Remove the
  // callback immediately so overlapping loads on this loader stay independent.
  loader.register(split);
  try {
    return loader.parseAsync(buffer, path);
  } finally {
    loader.unregister(split);
  }
}
