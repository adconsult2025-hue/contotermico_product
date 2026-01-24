// ESG calculation engine replicated from the NUOVA repository. Provides
// functions to compute CO₂ emissions, energy autonomy, shared energy
// percentage, social metrics and composite ESG scores. These utilities are
// used by the Conto Termico incentives calculator to update ESG values on
// practices.

const clamp = (value, min = 0, max = 100) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(Math.max(num, min), max);
};

function calcCo2(productionKwh, emissionFactor = 0.406) {
  const prod = Number(productionKwh) || 0;
  const co2_kg = prod * emissionFactor;
  const co2_ton = co2_kg / 1000;
  return { co2_kg, co2_ton };
}

function calcAutonomy(productionKwh, consumptionKwh) {
  const prod = Number(productionKwh) || 0;
  const cons = Number(consumptionKwh) || 0;
  if (cons <= 0) return 0;
  return (prod / cons) * 100;
}

function calcSharedEnergyPct(sharedKwh, totalConsumptionKwh) {
  const shared = Number(sharedKwh) || 0;
  const total = Number(totalConsumptionKwh) || 0;
  if (total <= 0) return 0;
  return (shared / total) * 100;
}

function calcSocialMetrics({ vulnerableCount, totalFamilies }) {
  const total = Number(totalFamilies) || 0;
  const vulnerable = Number(vulnerableCount) || 0;
  if (total > 0) {
    return { vulnerable_pct: (vulnerable / total) * 100 };
  }
  return { vulnerable_pct: null };
}

function calcEnvScore(kpi = {}) {
  const autonomy = clamp(kpi.autonomy_pct ?? 0);
  const shared = clamp(kpi.shared_pct ?? 0);
  const co2 = clamp((kpi.co2_kg ?? 0) / 10, 0, 100); // TODO: calibrate on real benchmarks
  const weighted = co2 * 0.3 + autonomy * 0.45 + shared * 0.25;
  return clamp(weighted, 0, 100);
}

function calcSocialScore(kpi = {}) {
  const vulnerablePct = kpi.vulnerable_pct;
  const safeVulnerable = Number.isFinite(vulnerablePct) ? clamp(100 - vulnerablePct) : 50; // lower vulnerable = better
  const saving = Number(kpi.avg_saving_family_eur_year) || 0;
  const savingScore = clamp(saving / 20, 0, 100); // TODO: calibrate on real thresholds
  const weighted = safeVulnerable * 0.6 + savingScore * 0.4;
  return clamp(weighted, 0, 100);
}

function calcGovScore(kpi = {}) {
  const base = Number(kpi.gov_base_score ?? kpi.govScore ?? 50) || 50; // TODO: derive from policy/regulatory metrics
  return clamp(base, 0, 100);
}

function calcEsgScore({ envScore, socialScore, govScore }) {
  const e = Number.isFinite(envScore) ? envScore : 0; // TODO: handle null scores with warning
  const s = Number.isFinite(socialScore) ? socialScore : 0;
  const g = Number.isFinite(govScore) ? govScore : 0;

  const esg_score = clamp(e * 0.5 + s * 0.3 + g * 0.2, 0, 100);
  let esg_class = 'C';
  if (esg_score >= 80) esg_class = 'A';
  else if (esg_score >= 60) esg_class = 'B';

  return { esg_score, esg_class };
}

function validateInterventions(interventions) {
  const thermalSelected = interventions.some((it) => ['termico'].includes(it.category));
  const invalid = interventions.filter((it) => it.eligibility_condition === 'requires_thermal' && !thermalSelected);
  return {
    valid: invalid.length === 0,
    invalid,
  };
}

export {
  calcCo2,
  calcAutonomy,
  calcSharedEnergyPct,
  calcSocialMetrics,
  calcEsgScore,
  calcEnvScore,
  calcSocialScore,
  calcGovScore,
  validateInterventions,
};
