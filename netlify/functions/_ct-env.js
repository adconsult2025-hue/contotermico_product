function cleanEnvValue(v) {
  if (v == null) return '';
  let s = String(v).trim();

  // rimuove virgolette “accidentali”
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }

  // normalizza eventuali newline escape
  s = s.replace(/\\n/g, '\n').trim();

  return s;
}

function findNonAscii(s) {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code > 255) return { index: i, code };
  }
  return null;
}

function mustGetEnv(name) {
  const raw = process.env[name];
  const v = cleanEnvValue(raw);
  if (!v) throw new Error(`Missing env ${name}`);
  const bad = findNonAscii(v);
  if (bad) {
    const ch = v[bad.index];
    const preview = v.slice(Math.max(0, bad.index - 10), bad.index + 10);
    const err = new Error(
      `Env ${name} contiene carattere non valido "${ch}" (codepoint=${bad.code}) a index=${bad.index}. Preview="${preview}"`
    );
    err._env_bad = { name, ...bad, ch, preview };
    throw err;
  }
  return v;
}

module.exports = { mustGetEnv, cleanEnvValue, findNonAscii };
