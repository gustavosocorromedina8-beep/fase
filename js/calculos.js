// Cálculos exactos en JavaScript: estos resultados nunca pasan por la IA.
export const GAMMA = { cobre: { 20: 56, 70: 48, 90: 44 }, aluminio: { 20: 35, 70: 30, 90: 28 } };
export const SECCIONES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];

export const fmt = (n, d = 2) => {
  if (!Number.isFinite(n)) return '—';
  return Number(n.toFixed(d)).toLocaleString('es-ES', { maximumFractionDigits: d });
};

export function ohm({ V, I, R }) {
  if (V != null && I != null) return { V, I, R: V / I, P: V * I };
  if (V != null && R != null) return { V, R, I: V / R, P: (V * V) / R };
  if (I != null && R != null) return { I, R, V: I * R, P: I * I * R };
  return null;
}

export function potenciaCA({ V, I, P, cos = 1, tri = false }) {
  const k = tri ? Math.sqrt(3) : 1;
  const pActiva = P != null ? P : k * V * I * cos;
  const inten = I != null ? I : pActiva / (k * V * cos);
  const S = k * V * inten;
  return { P: pActiva, I: inten, S, Q: Math.sqrt(Math.max(S * S - pActiva * pActiva, 0)) };
}

// Sección mínima por caída de tensión. pct en %, L en m, P en W.
export function seccion({ P, L, V, pct, tri = false, gamma = 48 }) {
  const e = (V * pct) / 100;
  const s = ((tri ? 1 : 2) * L * P) / (gamma * e * V);
  const comercial = SECCIONES.find((x) => x >= s) ?? null;
  return { e, s, comercial };
}

export function compensar({ P, cos1, cos2 }) {
  return { Qc: P * (Math.tan(Math.acos(cos1)) - Math.tan(Math.acos(cos2))) };
}

export function motorRpm({ f = 50, pares }) { return { n: (60 * f) / pares }; }

export function resistenciaLed({ Vf, Vled, mA }) {
  const R = (Vf - Vled) / (mA / 1000);
  return { R, P: (Vf - Vled) * (mA / 1000) };
}

// Lee valores con unidades de una pregunta escrita, p. ej. "230 V y 10 ohmios".
export function leerValores(texto) {
  const t = texto.toLowerCase().replace(/(\d),(\d)/g, '$1.$2');
  const leer = (re, mult = 1) => { const m = t.match(re); return m ? parseFloat(m[1]) * mult : null; };
  const num = '(\\d+(?:\\.\\d+)?)\\s*';
  const kw = leer(new RegExp(num + '(?:kw|kilovatios?)\\b'), 1000);
  const w = leer(new RegExp(num + '(?:w|vatios?|watts?)\\b'));
  const cosM = t.match(/(?:cos(?:eno)?\s*(?:de\s*)?(?:φ|phi|fi)?|factor de potencia(?: de)?)\s*(?:=|de)?\s*(0?\.\d+|1(?:\.0+)?)/);
  return {
    V: leer(new RegExp(num + '(?:v|voltios?)\\b')),
    I: leer(new RegExp(num + '(?:a|amperios?)\\b')) ?? leer(new RegExp(num + '(?:ma|miliamperios?)\\b'), 0.001),
    R: leer(new RegExp(num + '(?:ω|ohm(?:ios?|s)?)(?![a-z])')),
    P: kw ?? w,
    L: leer(new RegExp(num + '(?:m|metros?)\\b')),
    cos: cosM ? parseFloat(cosM[1]) : null,
    tri: /trif[aá]sic/.test(t),
  };
}

// Devuelve un resultado si la pregunta se puede calcular con exactitud; si no, null.
export function resolverPregunta(texto) {
  const v = leerValores(texto);
  const t = texto.toLowerCase();
  if (!/\d/.test(t)) return null;
  const pct = t.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*%/);

  if (/secci[oó]n/.test(t) && v.P != null && v.L != null) {
    const V = v.V ?? (v.tri ? 400 : 230);
    const p = pct ? parseFloat(pct[1]) : 3;
    const r = seccion({ P: v.P, L: v.L, V, pct: p, tri: v.tri });
    return {
      titulo: 'Sección por caída de tensión',
      pasos: [
        `Línea ${v.tri ? 'trifásica' : 'monofásica'} de cobre: ${fmt(v.P, 0)} W, ${fmt(v.L, 1)} m, ${fmt(V, 0)} V, caída del ${fmt(p, 1)} %, γ = 48 (70 °C).`,
        `e = ${fmt(p, 1)} % de ${fmt(V, 0)} V = ${fmt(r.e)} V`,
        `S = ${v.tri ? '' : '2 · '}${fmt(v.L, 1)} · ${fmt(v.P, 0)} / (48 · ${fmt(r.e)} · ${fmt(V, 0)}) = ${fmt(r.s)} mm²`,
      ],
      resultado: r.comercial ? `Sección comercial: ${fmt(r.comercial, 1)} mm²` : 'Supera 240 mm²: divide la línea o revisa los datos',
      nota: 'Comprueba también la intensidad admisible en la tabla de la ITC-BT-19.' + (pct ? '' : ' He supuesto una caída del 3 %, porque no indicabas otra.') + (v.V == null ? ` He supuesto ${fmt(V, 0)} V.` : ''),
    };
  }
  if (/(velocidad|rpm|revoluciones)/.test(t) && /(pares?|polos)/.test(t)) {
    const m = t.match(/(\d+)\s*pares?/); const p = t.match(/(\d+)\s*polos/);
    const pares = m ? +m[1] : p ? +p[1] / 2 : null;
    if (pares) {
      const f = t.match(/(\d+)\s*hz/) ? +t.match(/(\d+)\s*hz/)[1] : 50;
      return { titulo: 'Velocidad de sincronismo', pasos: [`n = 60 · f / p = 60 · ${f} / ${fmt(pares, 1)}`], resultado: `${fmt(motorRpm({ f, pares }).n, 0)} rpm`, nota: 'La velocidad real de un motor asíncrono es algo menor, por el deslizamiento.' };
    }
  }
  if (v.P != null && v.V != null && v.I == null && v.R == null) {
    const cos = v.cos ?? 1;
    const r = potenciaCA({ P: v.P, V: v.V, cos, tri: v.tri });
    return {
      titulo: `Intensidad en ${v.tri ? 'trifásica' : 'monofásica'}`,
      pasos: [`I = P / (${v.tri ? '√3 · ' : ''}V · cos φ) = ${fmt(v.P, 0)} / (${v.tri ? '1,732 · ' : ''}${fmt(v.V, 0)} · ${fmt(cos)})`],
      resultado: `I = ${fmt(r.I)} A`,
      nota: v.cos == null ? 'He supuesto cos φ = 1, porque no indicabas otro.' : '',
    };
  }
  const datos = [v.V, v.I, v.R].filter((x) => x != null).length;
  if (datos >= 2) {
    const r = ohm({ V: v.V, I: v.I, R: v.R });
    const pasos = [];
    if (v.V != null && v.R != null) pasos.push(`I = V / R = ${fmt(v.V)} / ${fmt(v.R)} = ${fmt(r.I)} A`);
    else if (v.V != null && v.I != null) pasos.push(`R = V / I = ${fmt(v.V)} / ${fmt(v.I)} = ${fmt(r.R)} Ω`);
    else pasos.push(`V = I · R = ${fmt(v.I)} · ${fmt(v.R)} = ${fmt(r.V)} V`);
    pasos.push(`P = ${fmt(r.V)} V · ${fmt(r.I)} A = ${fmt(r.P)} W`);
    return { titulo: 'Ley de Ohm', pasos, resultado: `V = ${fmt(r.V)} V · I = ${fmt(r.I)} A · R = ${fmt(r.R)} Ω · P = ${fmt(r.P)} W`, nota: 'Válido para corriente continua o cargas resistivas.' };
  }
  return null;
}
