import { getClient } from './_db.js';
import { getCurrentUser, requireRole } from './_auth.js';
import { calcCo2 } from '../../src/esg/esgEngine.js';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Accept, X-User-Id, X-User-Type, x-user-id, x-user-type',
};

function buildResponse(statusCode, payload) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(payload) };
}

function isMissingRelation(err) {
  return /relation .* does not exist/i.test(err?.message || '');
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSubjectType(st) {
  if (!st) return null;
  return String(st).trim().toUpperCase();
}

function buildWarning(msg) {
  return msg || 'Avviso';
}

function parseNotes(rawNotes) {
  if (!rawNotes) return {};
  const notes = {};
  String(rawNotes)
    .split(/;|\n|,/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [key, ...rest] = pair.split('=');
      if (!key || !rest.length) return;
      notes[key.trim().toLowerCase()] = rest.join('=').trim();
    });
  return notes;
}

function parseBoolean(value) {
  if (value === true || value === false) return value;
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'si', 's', 'on'].includes(normalized);
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return buildResponse(405, { ok: false, error: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return buildResponse(400, { ok: false, error: 'Invalid JSON body' });
  }

  const practiceId = body.practice_id;
  if (!practiceId) {
    return buildResponse(400, { ok: false, error: 'Missing practice_id' });
  }

  let db;

  try {
    const user = await getCurrentUser(event);
    requireRole(user, ['admin', 'superadmin', 'operator']);

    const client = await getClient();
    db = await client.connect();

    await db.query('BEGIN');

    const baseRes = await db.query(
      `SELECT p.id, p.ct_type, p.subject_id, p.title, p.esg_baseline_kwh, p.esg_post_kwh, p.esg_saved_kwh, p.esg_saving_pct, p.esg_co2_ton,
              p.is_public_building,
              s.subject_type,
              econ.version_code, econ.climate_zone, econ.building_scope, econ.is_small_municipality, econ.eligible_costs_total
       FROM public.ct_practices p
       LEFT JOIN public.ct_subjects s ON s.id = p.subject_id
       LEFT JOIN public.ct_practice_economics econ ON econ.practice_id = p.id
       WHERE p.id = $1
       LIMIT 1`,
      [practiceId],
    );

    if (!baseRes.rows.length) {
      await db.query('ROLLBACK');
      return buildResponse(404, { ok: false, error: 'Practice not found' });
    }

    const practice = baseRes.rows[0];
    const subjectType = normalizeSubjectType(practice.subject_type);
    const versionCode = practice.version_code || 'CT3_DM_2025_08_07';
    const climateZone = practice.climate_zone || null;
    const buildingScope = practice.building_scope || null;
    const isSmallMunicipality = practice.is_small_municipality === true;

    const interventionsRes = await db.query(
      `SELECT cpi.intervention_code, cpi.is_combined_insulation, ci.category
       FROM public.ct_practice_interventions cpi
       INNER JOIN public.ct_interventions ci ON ci.code = cpi.intervention_code
       WHERE cpi.practice_id = $1
       ORDER BY ci.category, ci.code`,
      [practiceId],
    );

    if (!interventionsRes.rows.length) {
      await db.query('ROLLBACK');
      return buildResponse(422, { ok: false, error: 'Nessun intervento selezionato per la pratica' });
    }

    const econLinesRes = await db.query(
      `SELECT intervention_code, main_value, unit, eligible_costs, notes, is_eu_component, pv_registration_level
       FROM public.ct_practice_intervention_economics
       WHERE practice_id = $1`,
      [practiceId],
    );
    const econMap = new Map();
    econLinesRes.rows.forEach((row) => econMap.set(row.intervention_code, row));

    const warnings = [];
    const details = [];
    const incentives = [];

    for (const selected of interventionsRes.rows) {
      const econ = econMap.get(selected.intervention_code);
      if (!econ || econ.main_value == null || !econ.unit) {
        warnings.push(buildWarning(`dati economia mancanti per ${selected.intervention_code}`));
        continue;
      }

      const { rows: coeffRows } = await db.query(
        `SELECT *
         FROM public.ct_calc_coefficients
         WHERE version_code = $1
           AND intervention_code = $2
           AND subject_type = $3
           AND building_scope = $4
           AND (climate_zone IS NULL OR climate_zone = $5)
         ORDER BY (climate_zone IS NULL) ASC
         LIMIT 1`,
        [versionCode, selected.intervention_code, subjectType, buildingScope, climateZone],
      );

      const coeff = coeffRows[0];
      if (!coeff) {
        warnings.push(buildWarning(`coefficiente mancante per ${selected.intervention_code}`));
        continue;
      }

      const mainValue = toNumber(econ.main_value);
      if (mainValue === null) {
        warnings.push(buildWarning(`valore principale non valido per ${selected.intervention_code}`));
        continue;
      }

      const gross = mainValue * Number(coeff.coeff_eur_per_unit);
      const defaultCap = subjectType === 'PA' && isSmallMunicipality ? 1.0 : 0.65;
      let capRate = coeff.cap_rate != null ? Number(coeff.cap_rate) : defaultCap;

      if (climateZone === 'E' || climateZone === 'F') {
        capRate = Math.max(capRate, 0.5);
      }

      if (selected.is_combined_insulation) {
        capRate = Math.max(capRate, 0.55);
      }

      if (practice.is_public_building) {
        capRate = 1.0;
      }

      if (econ.is_eu_component) {
        capRate = Math.min(capRate * 1.1, 1.0);
      }

      const pvRegistrationLevel = Number(econ.pv_registration_level) || 0;
      if (pvRegistrationLevel > 0) {
        capRate = Math.min(capRate * (1 + pvRegistrationLevel / 100), 1.0);
      }

      let net = gross;
      if (econ.eligible_costs != null) {
        net = Math.min(gross, Number(econ.eligible_costs) * capRate);
      } else {
        warnings.push(buildWarning(`cap non applicato: costi non indicati per ${selected.intervention_code}`));
      }

      const durationYears = Number(coeff.duration_years) || 5;

      details.push({
        intervention_code: selected.intervention_code,
        main_value: mainValue,
        unit: econ.unit,
        coeff: Number(coeff.coeff_eur_per_unit),
        gross_i: gross,
        net_i: net,
        duration_i: durationYears,
      });

      incentives.push({ net, durationYears, capRate });
    }

    if (!incentives.length) {
      await db.query('ROLLBACK');
      return buildResponse(422, {
        ok: false,
        error: 'Coefficienti o dati economici mancanti per tutti gli interventi selezionati',
        warnings,
      });
    }

    const totalGross = details.reduce((sum, d) => sum + Number(d.gross_i || 0), 0);
    const totalNet = details.reduce((sum, d) => sum + Number(d.net_i || 0), 0);
    const durationYears = Math.max(...incentives.map((i) => i.durationYears));

    const rates = [];
    for (let year = 1; year <= durationYears; year++) {
      const amount = incentives
        .filter((i) => i.durationYears >= year)
        .reduce((sum, i) => sum + i.net / i.durationYears, 0);
      rates.push(Math.round((amount + Number.EPSILON) * 100) / 100);
    }

    const roundedTotal = rates.reduce((sum, r) => sum + r, 0);
    const diff = Math.round(((totalNet - roundedTotal) + Number.EPSILON) * 100) / 100;
    if (rates.length) {
      rates[rates.length - 1] = Math.round(((rates[rates.length - 1] + diff) + Number.EPSILON) * 100) / 100;
    }

    const aggregateCapRate = incentives[0]?.capRate ?? null;

    await db.query(
      `INSERT INTO public.ct_practice_incentives
         (practice_id, version_code, computed_at, subject_type, climate_zone, building_scope, cap_rate, total_gross, total_net, duration_years, rates, details, warnings)
       VALUES ($1, $2, now(), $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb)
       ON CONFLICT (practice_id) DO UPDATE SET
         version_code = EXCLUDED.version_code,
         computed_at = now(),
         subject_type = EXCLUDED.subject_type,
         climate_zone = EXCLUDED.climate_zone,
         building_scope = EXCLUDED.building_scope,
         cap_rate = EXCLUDED.cap_rate,
         total_gross = EXCLUDED.total_gross,
         total_net = EXCLUDED.total_net,
         duration_years = EXCLUDED.duration_years,
         rates = EXCLUDED.rates,
         details = EXCLUDED.details,
         warnings = EXCLUDED.warnings;`,
      [
        practiceId,
        versionCode,
        subjectType,
        climateZone,
        buildingScope,
        aggregateCapRate,
        totalGross,
        totalNet,
        durationYears,
        JSON.stringify(rates),
        JSON.stringify(details),
        JSON.stringify(warnings),
      ],
    );

    if (practice.esg_saved_kwh != null) {
      const { co2_ton } = calcCo2(practice.esg_saved_kwh);
      await db.query(
        `UPDATE public.ct_practices
         SET esg_co2_ton = $2
         WHERE id = $1`,
        [practiceId, co2_ton],
      );
    }

    await db.query('COMMIT');

    return buildResponse(200, {
      ok: true,
      total_gross: totalGross,
      total_net: totalNet,
      cap_rate: aggregateCapRate,
      duration_years: durationYears,
      rates,
      warnings,
      details,
    });
  } catch (err) {
    if (db) {
      try {
        await db.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('ct-incentives-calc rollback error', rollbackErr);
      }
    }
    console.error('ct-incentives-calc error', err);
    if (isMissingRelation(err)) {
      return buildResponse(500, { ok: false, error: 'Schema CT economics non disponibile: eseguire migrazione DB.' });
    }
    return buildResponse(500, { ok: false, error: err.message || 'Internal error' });
  } finally {
    if (db) db.release();
  }
};
