import { useState, useRef, useEffect, type ComponentPropsWithRef } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "../../shell/icons";
import "./iconButton.css";

/** Standard compact action: the name remains available to keyboard and assistive users. */
export function IconButton({icon,label,children,className="",onFocus,onBlur,onKeyDown,...props}: ComponentPropsWithRef<"button"> & {icon:IconName;label:string}) {
  const tooltip = useRef<HTMLSpanElement>(null);
  const [hint,setHint]=useState<{left:number;top:number}|null>(null);
  useEffect(() => {
    if (!hint) return;
    const frame = requestAnimationFrame(() => {
      const element = tooltip.current;
      if (element?.isConnected && !element.matches(":popover-open")) element.showPopover();
    });
    const hide = () => setHint(null);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, [hint]);
  return <><button {...props} type={props.type ?? "button"} title={props.title ?? props["aria-label"] ?? label} aria-label={props["aria-label"] ?? label}
    className={`tool icon-action ${children == null ? "icon-only" : ""} ${className}`}
    onFocus={event=>{if(event.currentTarget.matches(":focus-visible")){const r=event.currentTarget.getBoundingClientRect();setHint({left:Math.max(8,Math.min(r.left,innerWidth-248)),top:r.bottom+6>innerHeight-50?Math.max(8,r.top-42):r.bottom+6});}onFocus?.(event);}}
    onBlur={event=>{setHint(null);onBlur?.(event);}} onKeyDown={event=>{if(event.key==="Escape")setHint(null);onKeyDown?.(event);}}>
    <Icon name={icon}/>{children}
  </button>{hint && createPortal(<span ref={tooltip} popover="manual" className="icon-action-hint" style={hint} aria-hidden="true">{props.title ?? props["aria-label"] ?? label}</span>,document.body)}</>;
}
