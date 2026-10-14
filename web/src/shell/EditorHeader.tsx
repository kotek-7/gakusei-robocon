import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

/** Blender-style header: wheel or middle-button drag pans the whole row. */
export function EditorHeader(props: ComponentPropsWithoutRef<"header">) {
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ pointerId: number; x: number; scroll: number } | null>(null);

  useEffect(() => {
    const header = ref.current!;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || header.scrollWidth <= header.clientWidth) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? header.clientWidth : 1;
      event.preventDefault();
      header.scrollLeft += delta * unit;
    };
    header.addEventListener("wheel", wheel, { passive: false });
    return () => header.removeEventListener("wheel", wheel);
  }, []);

  return <header {...props} ref={ref}
    onPointerDownCapture={event => {
      const header = event.currentTarget;
      if (event.button !== 1 || header.scrollWidth <= header.clientWidth) return;
      event.preventDefault();
      drag.current = { pointerId: event.pointerId, x: event.clientX, scroll: header.scrollLeft };
      header.setPointerCapture(event.pointerId);
      header.dataset.panning = "true";
    }}
    onPointerMove={event => {
      const start = drag.current;
      if (start?.pointerId === event.pointerId) event.currentTarget.scrollLeft = start.scroll + start.x - event.clientX;
    }}
    onPointerUp={event => {
      if (drag.current?.pointerId !== event.pointerId) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      drag.current = null;
      delete event.currentTarget.dataset.panning;
    }}
    onLostPointerCapture={event => {
      drag.current = null;
      delete event.currentTarget.dataset.panning;
    }}
    onAuxClick={event => { if (event.button === 1) event.preventDefault(); }}
  />;
}
