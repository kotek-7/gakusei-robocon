import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StrategyList } from "../catalog/StrategyList";
import { canonicalPlans } from "../catalog/navigation";

test("strategy list exposes directly selectable plans with bounded pagination", () => {
  const plans = canonicalPlans();
  const html = renderToStaticMarkup(createElement(StrategyList, { plans, current: plans[1], onSelect() {} }));
  assert.equal((html.match(/class="strategy-item"/g) || []).length, 20);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(html, /297案/);
  assert.match(html, /この作戦を再生/);
});
