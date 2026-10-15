/** Coalesces scene changes and keeps them pending while a mounted viewport is hidden. */
export function createRenderDemand() {
  let dirty = true;
  let wasVisible = false;
  return {
    invalidate() { dirty = true; },
    consume(visible: boolean) {
      if (!visible) {
        wasVisible = false;
        return false;
      }
      const render = dirty || !wasVisible;
      wasVisible = true;
      dirty = false;
      return render;
    },
  };
}
