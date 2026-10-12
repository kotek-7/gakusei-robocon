import { zoneNames } from "./plans";
import { dimensions, type Dimension } from "./navigation";
import type { Zone, Access } from "../simulation/types";
export const span = (range: number[] | null) =>
  range
    ? range[0] === range[1]
      ? String(range[0])
      : `${range[0]}–${range[1]}`
    : "未計算";
export const route = (access: Access) =>
  access === "ramp" ? "スロープ" : "階段";
export const label = (id: Dimension, value: string) =>
  id === "zones"
    ? value
        .split("")
        .map((z) => zoneNames[z as Zone])
        .join(" → ")
    : (dimensions
        .find((d) => d.id === id)
        ?.options?.find((o) => o[0] === value)?.[1] ?? value);
