export function downloadResult(result) {
  const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "strata-strategy.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
