/** Top-level dashboard segment — avoids re-animating tab switches inside a section. */
export function dashboardTopLevelAnimateKey(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "dashboard") return pathname;
  if (segments.length <= 1) return "home";
  return segments[1] ?? "home";
}
