import loadHighs from "highs";
import type { LegacyHighs } from "highs";
import { assert } from "./util";
let solver: Promise<LegacyHighs> | undefined;
export function initSolver(wasmURL?: string) {
  return (solver ??= loadHighs(
    wasmURL ? { locateFile: () => wasmURL } : {},
  ).catch((e) => {
    solver = undefined;
    throw e;
  }));
}
/** Maximize the worst column payoff, optionally retaining a win lower bound. */
export async function matrixValue(
  payoff: number[][],
  wins?: number[][],
  bound?: number,
): Promise<[number, number[]]> {
  assert(
    payoff.length &&
      payoff[0].length &&
      payoff.every(
        (row) => row.length === payoff[0].length && row.every(Number.isFinite),
      ),
    "不正なゲーム行列です",
  );
  const highs = await initSolver(),
    m = payoff.length,
    n = payoff[0].length;
  const terms = (vals: number[]) =>
    vals.map((v, i) => `${v < 0 ? "-" : "+"} ${Math.abs(v)} p${i}`).join(" ");
  const lines = [
    "Maximize",
    " obj: value",
    "Subject To",
    ` mass: ${terms(Array(m).fill(1))} = 1`,
  ];
  for (let j = 0; j < n; j++) {
    lines.push(
      ` payoff${j}: ${terms(payoff.map((row) => row[j]))} - value >= 0`,
    );
    if (wins)
      lines.push(
        ` win${j}: ${terms(wins.map((row) => row[j]))} >= ${bound! - 1e-8}`,
      );
  }
  lines.push(
    "Bounds",
    " value free",
    ...Array.from({ length: m }, (_, i) => ` 0 <= p${i} <= 1`),
    "End",
  );
  const result = highs.solve(lines.join("\n"), {
    output_flag: false,
    time_limit: 2,
  });
  assert(
    result.Status === "Optimal",
    `同時行動ゲームの計算が完了しませんでした: ${result.Status}`,
  );
  const primal = (name: string) => {
    const col = result.Columns[name];
    assert(
      col && "Primal" in col && Number.isFinite(col.Primal),
      "ソルバーの結果が不正です",
    );
    return col.Primal === 0 ? 0 : col.Primal;
  };
  return [
    primal("value"),
    Array.from({ length: m }, (_, i) => primal(`p${i}`)),
  ];
}
