export function duration(seconds: number) {
  if (seconds < 60) return `${seconds.toFixed(1)}秒`;
  const whole = Math.floor(seconds);
  if (whole < 3600) return `${Math.floor(whole / 60)}分${whole % 60}秒`;
  return `${Math.floor(whole / 3600)}時間${Math.floor((whole % 3600) / 60)}分`;
}

export const stopLabels: Record<string, string> = {
  exhausted: "対象範囲を探索済み",
  time_limit: "指定時間で中断",
  cancelled: "操作により停止",
  interrupted: "画面を閉じたため中断",
  budget_limit: "指定の行動組数に到達",
  completed: "計算完了",
  resource_limit: "保存量の上限で中断",
  error: "エラーで中断",
};

export { DiscoveryProgress } from "./DiscoveryHistory";
