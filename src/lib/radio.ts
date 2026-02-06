const DEFAULT_RADIO_BASE_URL = "https://radio.somdomato.com";
const DEFAULT_MOUNTPOINT = "geral";

const KNOWN_MOUNTPOINTS = new Set([
  "geral",
  "gaucha",
  "modao",
  "arrocha",
  "romantico",
  "forro",
]);

function stripTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

export function getRadioBaseUrl(raw?: string) {
  const candidate = stripTrailingSlashes((raw || "").trim());
  const base = candidate.length > 0 ? candidate : DEFAULT_RADIO_BASE_URL;
  const parts = base.split("/");
  const last = parts[parts.length - 1];

  if (KNOWN_MOUNTPOINTS.has(last)) {
    const stripped = parts.slice(0, -1).join("/");
    return stripped.length > 0 ? stripped : DEFAULT_RADIO_BASE_URL;
  }

  return base;
}

export function buildStreamUrl(mountpoint?: string, rawBase?: string) {
  const base = getRadioBaseUrl(rawBase);
  const resolved = (mountpoint || "").replace(/^\/+/, "");
  const finalMount = KNOWN_MOUNTPOINTS.has(resolved)
    ? resolved
    : DEFAULT_MOUNTPOINT;
  return `${base}/${finalMount}`;
}

export { DEFAULT_MOUNTPOINT };
