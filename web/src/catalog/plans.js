export const zoneNames = { P: "L1自陣", S: "L1共有", U: "L2" };
export function catalog() {
  let a = [];
  for (let x of ["S", "P", "U"])
    for (let y of ["P", "S", "U"])
      for (let mode of ["build", "reuse", "flip"])
        for (let mission of [true, false])
          for (let supply of ["balanced", "earth", "sky"])
            for (let end of ["expand", "flip", "late"]) {
              if (x === "P" && y === "P" && (mission || mode !== "build"))
                continue;
              a.push({
                id: a.length + 1,
                zones: [x, y],
                mode,
                mission,
                supply,
                end,
              });
            }
  return a;
}
export const modes = {
    build: "一から積み上げる",
    reuse: "土台を利用",
    flip: "上段ブロックを裏返す",
  },
  ends = { expand: "積み上げを継続", flip: "裏返しを優先", late: "終盤に裏返し" },
  supplies = {
    balanced: "土台を確保して供給",
    earth: "土台を優先して搬送",
    sky: "上段ブロックを優先して搬送",
  };
export const title = (p) => p.zones.map((z) => zoneNames[z]).join(" → ");
