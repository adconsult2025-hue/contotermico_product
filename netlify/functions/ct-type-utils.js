const CT_TYPE_ALIASES = {
  // Canonical CT types for Conto Termico 3.0
  pa: 'pa',
  condominio: 'condominio',
  privato_residenziale: 'privato_residenziale',
  privato_non_residenziale: 'privato_non_residenziale',
  ets: 'ets',
  esco: 'esco',

  // Legacy aliases for backward compatibility
  privato: 'privato_residenziale',
  privato_res: 'privato_residenziale',
  azienda: 'privato_non_residenziale',
  impresa: 'privato_non_residenziale',
  terzo: 'ets',
  terzo_settore: 'ets',
  ente_terzo_settore: 'ets',
  enti_terzo_settore: 'ets',
};

// Set of allowed CT types
export const ALLOWED_CT_TYPES = new Set(Object.values(CT_TYPE_ALIASES));

// Normalize raw ct_type strings by trimming, lower‑casing and replacing dashes with underscores
export function normalizeCtType(rawCtType) {
  if (rawCtType === null || rawCtType === undefined) return null;
  const normalized = String(rawCtType).trim().toLowerCase().replace(/-/g, '_');
  if (!normalized) return null;
  return normalized;
}

// Resolve a raw ct_type to its canonical representation, following aliases when present
export function resolveCtType(rawCtType) {
  const normalized = normalizeCtType(rawCtType);
  if (!normalized) return null;
  return CT_TYPE_ALIASES[normalized] || normalized;
}

/*
 * Given a raw ct_type, return the resolved canonical type and a list of fallback candidates.
 * Certain types (e.g. privato_residenziale) fall back to related types if no checklist exists.
 */
export function getCtTypeCandidates(rawCtType) {
  const resolved = resolveCtType(rawCtType);
  if (!resolved) return { resolved: null, candidates: [] };
  const candidates = [resolved];
  // Provide sensible fallbacks: e.g. privato_residenziale uses condominio checklist if missing
  if (resolved === 'privato_residenziale' && !candidates.includes('condominio')) candidates.push('condominio');
  if (resolved === 'privato_non_residenziale' && !candidates.includes('ets')) candidates.push('ets');
  if (resolved === 'esco' && !candidates.includes('ets')) candidates.push('ets');
  // Legacy fallback: if "terzo" checklists still exist, use them as last resort
  if (!candidates.includes('terzo')) candidates.push('terzo');
  return { resolved, candidates };
}

// List all accepted ct_type keys (including aliases) in sorted order
export function listAcceptedCtTypes() {
  return Object.keys(CT_TYPE_ALIASES).sort();
}
