import { getClient } from './_db.js';
import { getCurrentUser } from './_auth.js';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Accept, X-User-Id, X-User-Type, x-user-id, x-user-type',
};

const expectedHeaders = [
  'intervention_code',
  'subject_type',
  'building_scope',
  'climate_zone',
  'unit',
  'coeff_eur_per_unit',
  'duration_years',
  'cap_rate',
  'notes',
];

const allowedUnits = new Set(['kW', 'm2', 'kWh', 'unit']);
const allowedScopes = new Set(['TERZIARIO', 'RESIDENZIALE']);
const allowedZones = new Set(['A', 'B', 'C', 'D', 'E', 'F']);

function buildResponse(statusCode, payload) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(payload) };
}

function isMissingRelation(err) {
  return /relation .*ct_(calc_|interventions)/i.test(err?.message || '');
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length);

  if (!lines.length) {
    throw new Error('CSV vuoto');
  }

  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  if (header.length !== expectedHeaders.length || !header.every((h, idx) => h === expectedHeaders[idx])) {
    throw new Error(`Header CSV non valido. Atteso: ${expectedHeaders.join(',')}`);
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCsvLine(lines[i]).map((v) => v.trim());
    const row = {};
    expectedHeaders.forEach((key, idx) => {
      row[key] = values[idx] || '';
    });
    rows.push({ rowNumber: i + 1, row });
  }
  return rows;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return num;
}

function validateRow(rawRow, interventionsSet) {
  const errors = [];
  const row = { ...rawRow };

  row.intervention_code = (row.intervention_code || '').trim();
  row.subject_type = (row.subject_type || '').trim();
  row.building_scope = (row.building_scope || '').trim().toUpperCase();
  row.climate_zone = (row.climate_zone || '').trim().toUpperCase();
  row.unit = (row.unit || '').trim();
  row.notes = row.notes || null;

  if (!interventionsSet.has(row.intervention_code)) {
    errors.push('intervention_code non presente in ct_interventions');
  }

  if (!row.subject_type) {
    errors.push('subject_type obbligatorio');
  }

  if (!allowedScopes.has(row.building_scope)) {
    errors.push('building_scope non valido');
  }

  if (row.climate_zone && !allowedZones.has(row.climate_zone)) {
    errors.push('climate_zone non valido');
  }

  if (!allowedUnits.has(row.unit)) {
    errors.push('unit non valido');
  }

  const coeff = normalizeNumber(row.coeff_eur_per_unit);
  if (coeff === null || coeff <= 0) {
    errors.push('coeff_eur_per_unit deve essere numerico > 0');
  }

  let duration = row.duration_years;
  if (!duration && duration !== 0) {
    duration = 5;
  }
  duration = parseInt(duration, 10);
  if (!Number.isInteger(duration) || duration < 1 || duration > 10) {
    errors.push('duration_years deve essere intero tra 1 e 10');
  }

  let capRate = row.cap_rate;
  if (capRate === '' || capRate === null || capRate === undefined) {
    capRate = null;
  } else {
    capRate = normalizeNumber(capRate);
    if (capRate === null || capRate < 0 || capRate > 1) {
      errors.push('cap_rate deve essere compreso tra 0 e 1');
    }
  }

  return {
    errors,
    normalized: {
      intervention_code: row.intervention_code,
      subject_type: row.subject_type,
      building_scope: row.building_scope,
      climate_zone: row.climate_zone || null,
      unit: row.unit,
      coeff_eur_per_unit: coeff,
      duration_years: duration,
      cap_rate: capRate,
      notes: row.notes,
    },
  };
}

async function logActor(event) {
  try {
    const user = await getCurrentUser(event);
    if (user?.user?.email) {
      console.log('[ct-calc-coeff-import] actor', user.user.email);
    }
  } catch (err) {
    console.log('[ct-calc-coeff-import] actor unknown');
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return buildResponse(405, { ok: false, error: 'Method not allowed' });
  }

  await logActor(event);

  try {
    const payload = JSON.parse(event.body || '{}');
    const versionCode = (payload.version_code || '').trim();
    const mode = payload.mode || 'csv';

    if (!versionCode) {
      return buildResponse(400, { ok: false, error: 'version_code obbligatorio' });
    }

    const db = await getClient();

    const versionRes = await db.query(
      'SELECT version_code FROM public.ct_calc_versions WHERE version_code = $1 LIMIT 1',
      [versionCode],
    );
    if (!versionRes.rows.length) {
      return buildResponse(400, { ok: false, error: 'Versione non trovata' });
    }

    const interventionsRes = await db.query('SELECT code FROM public.ct_interventions');
    const interventionsSet = new Set((interventionsRes.rows || []).map((r) => r.code));

    let parsedRows = [];
    if (mode === 'csv') {
      if (!payload.csv_text) {
        return buildResponse(400, { ok: false, error: 'csv_text richiesto in modalità csv' });
      }
      parsedRows = parseCsv(payload.csv_text);
    } else if (mode === 'json') {
      if (!Array.isArray(payload.rows)) {
        return buildResponse(400, { ok: false, error: 'rows deve essere un array' });
      }
      parsedRows = payload.rows.map((row, idx) => ({ rowNumber: idx + 1, row }));
    } else {
      return buildResponse(400, { ok: false, error: 'mode non supportata' });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const { rowNumber, row } of parsedRows) {
      const { errors: rowErrors, normalized } = validateRow(row, interventionsSet);
      if (rowErrors.length) {
        errors.push({ row: rowNumber, message: rowErrors.join('; ') });
        skipped += 1;
        continue;
      }

      try {
        const updateRes = await db.query(
          `UPDATE public.ct_calc_coefficients
           SET coeff_eur_per_unit = $6, duration_years = $7, cap_rate = $8, notes = $9, unit = $5
           WHERE version_code = $1
             AND intervention_code = $2
             AND subject_type = $3
             AND building_scope = $4
             AND climate_zone IS NOT DISTINCT FROM $10`,
          [
            versionCode,
            normalized.intervention_code,
            normalized.subject_type,
            normalized.building_scope,
            normalized.unit,
            normalized.coeff_eur_per_unit,
            normalized.duration_years,
            normalized.cap_rate,
            normalized.notes,
            normalized.climate_zone,
          ],
        );

        if (updateRes.rowCount > 0) {
          updated += 1;
          continue;
        }

        const insertRes = await db.query(
          `INSERT INTO public.ct_calc_coefficients
             (version_code, intervention_code, subject_type, building_scope, climate_zone, unit, coeff_eur_per_unit, duration_years, cap_rate, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (version_code, intervention_code, subject_type, building_scope, climate_zone)
           DO NOTHING`,
          [
            versionCode,
            normalized.intervention_code,
            normalized.subject_type,
            normalized.building_scope,
            normalized.climate_zone,
            normalized.unit,
            normalized.coeff_eur_per_unit,
            normalized.duration_years,
            normalized.cap_rate,
            normalized.notes,
          ],
        );

        if (insertRes.rowCount > 0) {
          inserted += 1;
        } else {
          skipped += 1;
        }
      } catch (err) {
        console.error('ct-calc-coeff-import row error', err);
        errors.push({ row: rowNumber, message: err.message || 'Errore DB' });
        skipped += 1;
      }
    }

    return buildResponse(200, { ok: true, inserted, updated, skipped, errors });
  } catch (err) {
    console.error('ct-calc-coeff-import error', err);
    if (isMissingRelation(err)) {
      return buildResponse(500, { ok: false, error: 'Run db-migrate-ct-economics first' });
    }
    return buildResponse(err.statusCode || 500, { ok: false, error: err.message || 'Internal error' });
  }
};
