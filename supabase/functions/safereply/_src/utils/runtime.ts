/**
 * ランタイム差分（Node / Deno）を吸収するユーティリティ。
 */
export function getUptimeSeconds(): number {
  const runtimeProcess = (globalThis as { process?: { uptime?: () => number } }).process;
  if (runtimeProcess?.uptime) {
    return runtimeProcess.uptime();
  }
  return performance.now() / 1000;
}
