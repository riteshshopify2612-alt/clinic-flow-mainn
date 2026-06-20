const LEGACY_SUPABASE_PROJECT_ID = "qseoehlmbqptrovgvqij";

export const SUPABASE_PROJECT_ID = "pmzbcgbrraracyidyhpj";
export const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_qVUil_X_oCRXhvtQ3YEQrQ_vg7x7d9g";

function decodeBase64Url(value: string) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return globalThis.atob(padded);
  } catch {
    return "";
  }
}

function pointsAtLegacyProject(value?: string) {
  if (!value) return false;
  if (value.includes(LEGACY_SUPABASE_PROJECT_ID)) return true;

  const [, jwtPayload] = value.split(".");
  return decodeBase64Url(jwtPayload || "").includes(`"ref":"${LEGACY_SUPABASE_PROJECT_ID}"`);
}

export function resolveSupabaseUrl(value?: string) {
  return value && !pointsAtLegacyProject(value) ? value : SUPABASE_URL;
}

export function resolveSupabasePublishableKey(value?: string) {
  return value && !pointsAtLegacyProject(value) ? value : SUPABASE_PUBLISHABLE_KEY;
}
