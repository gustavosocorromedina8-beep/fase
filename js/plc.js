// Programas de ejemplo en Ladder (KOP) y simulador por ciclos, como un autómata real.
// Condición: 'I0.0' contacto abierto, '!I0.0' cerrado, 'P:I0.0' flanco positivo,
// ['s', ...] en serie y ['p', ...] en paralelo.
export const PROGRAMAS = [
  { id: 'and', titulo: 'Función Y: dos pulsadores a la vez', desc: 'La salida solo se activa con las dos entradas a 1. Es la base de un mando bimanual.',
    vars: { 'I0.0': ['Pulsador A', 'pulsador'], 'I0.1': ['Pulsador B', 'pulsador'], 'Q0.0': ['Prensa'] },
    redes: [{ txt: 'Contactos en serie', c: ['s', 'I0.0', 'I0.1'], o: [{ t: 'bobina', v: 'Q0.0' }] }],
    prueba: 'Mantén pulsado solo A: no pasa nada. Activa ahora A y B a la vez.' },
  { id: 'or', titulo: 'Función O: dos puntos de encendido', desc: 'La salida se activa con cualquiera de las dos entradas.',
    vars: { 'I0.0': ['Interruptor 1', 'interruptor'], 'I0.1': ['Interruptor 2', 'interruptor'], 'Q0.0': ['Lámpara'] },
    redes: [{ txt: 'Contactos en paralelo', c: ['p', 'I0.0', 'I0.1'], o: [{ t: 'bobina', v: 'Q0.0' }] }],
    prueba: 'Activa cualquiera de los dos interruptores.' },
  { id: 'not', titulo: 'Función NO: contacto cerrado', desc: 'La salida está activa mientras la entrada vale 0.',
    vars: { 'I0.0': ['Detector', 'interruptor'], 'Q0.0': ['Piloto'] },
    redes: [{ txt: 'Contacto cerrado', c: '!I0.0', o: [{ t: 'bobina', v: 'Q0.0' }] }],
    prueba: 'El piloto se apaga al activar el detector.' },
  { id: 'xor', titulo: 'Conmutada: función O exclusiva', desc: 'Cada interruptor cambia el estado de la lámpara, como una conmutada de pasillo.',
    vars: { 'I0.0': ['Conmutador 1', 'interruptor'], 'I0.1': ['Conmutador 2', 'interruptor'], 'Q0.0': ['Lámpara'] },
    redes: [{ txt: 'Solo uno de los dos activo', c: ['p', ['s', 'I0.0', '!I0.1'], ['s', '!I0.0', 'I0.1']], o: [{ t: 'bobina', v: 'Q0.0' }] }],
    prueba: 'Cambia cualquiera de los dos: la lámpara siempre cambia de estado.' },
  { id: 'marcha-paro', titulo: 'Marcha-paro con realimentación', desc: 'El contacto de la salida mantiene la marcha al soltar el pulsador. El paro y el térmico están cableados cerrados, así que en el programa son contactos abiertos.',
    vars: { 'I0.0': ['Marcha S1', 'pulsador'], 'I0.1': ['Paro S0 (cerrado)', 'nc'], 'I0.2': ['Térmico F1 (cerrado)', 'nc'], 'Q0.0': ['Motor KM1'] },
    redes: [{ txt: 'Marcha con retención', c: ['s', ['p', 'I0.0', 'Q0.0'], 'I0.1', 'I0.2'], o: [{ t: 'bobina', v: 'Q0.0' }] }],
    prueba: 'Pulsa Marcha y suelta: sigue funcionando. Pulsa Paro o dispara el térmico para parar.' },
  { id: 'set-reset', titulo: 'Marcha-paro con Set y Reset', desc: 'La misma maniobra con un biestable: Set activa y memoriza; Reset desactiva.',
    vars: { 'I0.0': ['Marcha S1', 'pulsador'], 'I0.1': ['Paro S0 (cerrado)', 'nc'], 'Q0.0': ['Motor KM1'] },
    redes: [{ txt: 'Activar', c: 'I0.0', o: [{ t: 'set', v: 'Q0.0' }] }, { txt: 'Desactivar: al estar después, tiene prioridad', c: '!I0.1', o: [{ t: 'reset', v: 'Q0.0' }] }],
    prueba: 'Mantén pulsados Marcha y Paro a la vez: manda el Reset, la última red.' },
  { id: 'telerruptor', titulo: 'Telerruptor con flanco', desc: 'Cada pulsación cambia el estado de la salida. El flanco hace que cuente solo una vez por pulsación.',
    vars: { 'I0.0': ['Pulsador', 'pulsador'], 'Q0.0': ['Lámpara'] },
    redes: [{ txt: 'Cambia de estado con cada flanco', c: ['p', ['s', 'P:I0.0', '!Q0.0'], ['s', '!P:I0.0', 'Q0.0']], o: [{ t: 'bobina', v: 'Q0.0' }] }],
    prueba: 'Pulsa una vez para encender y otra para apagar.' },
  { id: 'inversion', titulo: 'Inversión de giro con enclavamiento', desc: 'Cada sentido bloquea al otro con un contacto cerrado, para que nunca actúen los dos contactores.',
    vars: { 'I0.0': ['Derecha S1', 'pulsador'], 'I0.1': ['Izquierda S2', 'pulsador'], 'I0.2': ['Paro S0 (cerrado)', 'nc'], 'Q0.0': ['KM1 derecha'], 'Q0.1': ['KM2 izquierda'] },
    redes: [{ txt: 'Giro a la derecha', c: ['s', ['p', 'I0.0', 'Q0.0'], 'I0.2', '!Q0.1'], o: [{ t: 'bobina', v: 'Q0.0' }] }, { txt: 'Giro a la izquierda', c: ['s', ['p', 'I0.1', 'Q0.1'], 'I0.2', '!Q0.0'], o: [{ t: 'bobina', v: 'Q0.1' }] }],
    prueba: 'Con el motor a la derecha, pulsa Izquierda: no cambia hasta pulsar Paro.' },
  { id: 'retardo', titulo: 'Arranque con retardo (TON)', desc: 'La salida se activa cuando la entrada lleva 3 segundos activa.',
    vars: { 'I0.0': ['Interruptor', 'interruptor'], 'Q0.0': ['Motor'] },
    redes: [{ txt: 'Temporizador de 3 s', c: 'I0.0', o: [{ t: 'ton', v: 'T1', ms: 3000 }] }, { txt: 'Salida al terminar', c: 'T1', o: [{ t: 'bobina', v: 'Q0.0' }] }],
    prueba: 'Activa el interruptor y observa el tiempo. Si lo apagas antes, se reinicia.' },
  { id: 'estrella', titulo: 'Arranque estrella-triángulo', desc: 'Arranca en estrella y pasa a triángulo a los 5 segundos, con enclavamiento entre ambos.',
    vars: { 'I0.0': ['Marcha S1', 'pulsador'], 'I0.1': ['Paro S0 (cerrado)', 'nc'], 'M0.0': ['Marcha memorizada', 'marca'], 'Q0.0': ['KM1 principal'], 'Q0.1': ['KM2 estrella'], 'Q0.2': ['KM3 triángulo'] },
    redes: [
      { txt: 'Memoria de marcha', c: ['s', ['p', 'I0.0', 'M0.0'], 'I0.1'], o: [{ t: 'bobina', v: 'M0.0' }, { t: 'ton', v: 'T1', ms: 5000 }] },
      { txt: 'Contactor principal', c: 'M0.0', o: [{ t: 'bobina', v: 'Q0.0' }] },
      { txt: 'Estrella hasta que acaba el tiempo', c: ['s', 'M0.0', '!T1', '!Q0.2'], o: [{ t: 'bobina', v: 'Q0.1' }] },
      { txt: 'Triángulo al acabar el tiempo', c: ['s', 'T1', '!Q0.1'], o: [{ t: 'bobina', v: 'Q0.2' }] },
    ], prueba: 'Pulsa Marcha: entra KM2 en estrella y a los 5 s cambia a KM3.' },
  { id: 'contador', titulo: 'Contador de piezas (CTU)', desc: 'Cuenta cada pieza y activa la salida a las 5. El contador solo suma en el flanco de la entrada.',
    vars: { 'I0.0': ['Sensor de pieza', 'pulsador'], 'I0.1': ['Reset', 'pulsador'], 'Q0.0': ['Caja llena'] },
    redes: [{ txt: 'Cuenta hasta 5', c: 'I0.0', o: [{ t: 'ctu', v: 'C1', pv: 5, reset: 'I0.1' }] }, { txt: 'Aviso', c: 'C1', o: [{ t: 'bobina', v: 'Q0.0' }] }],
    prueba: 'Pulsa el sensor cinco veces. Reset vuelve a cero.' },
  { id: 'semaforo', titulo: 'Semáforo con temporizadores', desc: 'Secuencia cíclica: verde, ámbar y rojo, encadenando tres temporizadores.',
    vars: { 'I0.0': ['Marcha', 'interruptor'], 'Q0.0': ['Verde'], 'Q0.1': ['Ámbar'], 'Q0.2': ['Rojo'] },
    redes: [
      { txt: 'Tiempo de verde: 5 s', c: ['s', 'I0.0', '!T3'], o: [{ t: 'ton', v: 'T1', ms: 5000 }] },
      { txt: 'Tiempo de ámbar: 2 s', c: 'T1', o: [{ t: 'ton', v: 'T2', ms: 2000 }] },
      { txt: 'Tiempo de rojo: 5 s', c: 'T2', o: [{ t: 'ton', v: 'T3', ms: 5000 }] },
      { txt: 'Verde', c: ['s', 'I0.0', '!T1'], o: [{ t: 'bobina', v: 'Q0.0' }] },
      { txt: 'Ámbar', c: ['s', 'T1', '!T2'], o: [{ t: 'bobina', v: 'Q0.1' }] },
      { txt: 'Rojo', c: ['s', 'T2', '!T3'], o: [{ t: 'bobina', v: 'Q0.2' }] },
    ], prueba: 'Activa Marcha y deja que el ciclo se repita.' },
];
export const programa = (id) => PROGRAMAS.find((p) => p.id === id);

const esHoja = (n) => typeof n === 'string';
const partes = (hoja) => { const neg = hoja.startsWith('!'); const r = neg ? hoja.slice(1) : hoja; const flanco = r.startsWith('P:'); return { neg, flanco, v: flanco ? r.slice(2) : r }; };

// ---- Simulador ----
export class Simulador {
  constructor(prog) { this.prog = prog; this.reiniciar(); }
  reiniciar() {
    this.mem = {}; this.prev = {}; this.t = {}; this.c = {};
    for (const [v, d] of Object.entries(this.prog.vars)) this.mem[v] = d[1] === 'nc';
    this.prog.redes.forEach((r) => r.o.forEach((o) => { if (o.t === 'ton') this.t[o.v] = 0; if (o.t === 'ctu') this.c[o.v] = 0; this.mem[o.v] ??= false; }));
    this.flujo = {}; this.tiempo = null;
  }
  poner(v, on) { this.mem[v] = on; }
  evaluar(n, entra, ruta) {
    if (esHoja(n)) {
      const { neg, flanco, v } = partes(n);
      const señal = flanco ? this.mem[v] && !this.prev[v] : !!this.mem[v];
      const cierra = neg ? !señal : señal;
      const sale = entra && cierra;
      this.flujo[ruta] = { entra, sale, cierra };
      return sale;
    }
    const [tipo, ...h] = n;
    if (tipo === 's') { let e = entra; h.forEach((x, i) => { e = this.evaluar(x, e, `${ruta}.${i}`); }); this.flujo[ruta] = { entra, sale: e }; return e; }
    let alguna = false;
    h.forEach((x, i) => { if (this.evaluar(x, entra, `${ruta}.${i}`)) alguna = true; });
    this.flujo[ruta] = { entra, sale: alguna };
    return alguna;
  }
  // Un ciclo de programa: como en el PLC, las redes se ejecutan de arriba abajo.
  ciclo(dt) {
    this.prog.redes.forEach((r, i) => {
      const on = this.evaluar(r.c, true, `${i}`);
      r.o.forEach((o, k) => {
        this.flujo[`${i}:o${k}`] = on;
        if (o.t === 'bobina') this.mem[o.v] = on;
        if (o.t === 'set' && on) this.mem[o.v] = true;
        if (o.t === 'reset' && on) this.mem[o.v] = false;
        if (o.t === 'ton') { this.t[o.v] = on ? Math.min(this.t[o.v] + dt, o.ms) : 0; this.mem[o.v] = on && this.t[o.v] >= o.ms; }
        if (o.t === 'ctu') {
          const flanco = on && !this.prev[`${o.v}.e`];
          if (o.reset && this.mem[o.reset]) this.c[o.v] = 0; else if (flanco) this.c[o.v] += 1;
          this.prev[`${o.v}.e`] = on; this.mem[o.v] = this.c[o.v] >= o.pv;
        }
      });
    });
    for (const v of Object.keys(this.prog.vars)) this.prev[v] = this.mem[v];
  }
}

// ---- Dibujo ----
const AH = 78, AW = 96, OW = 150;
const med = (n) => {
  if (esHoja(n)) return { w: AW, h: AH };
  const [t, ...h] = n; const ms = h.map(med);
  return t === 's' ? { w: ms.reduce((a, m) => a + m.w, 0), h: Math.max(...ms.map((m) => m.h)) } : { w: Math.max(...ms.map((m) => m.w)) + 24, h: ms.reduce((a, m) => a + m.h, 0) };
};
const h = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const aLogo = (v) => {
  const m = v.match(/^([IQM])(\d+)\.(\d+)$/);
  return m ? `${m[1]}${+m[2] * 8 + +m[3] + 1}` : v;
};
function dir(v, modo) { return modo === 'logo' ? aLogo(v) : /^[IQM]\d/.test(v) ? `%${v}` : v; }
function dibujar(n, x, y, ruta, prog, modo) {
  const { w, h: alto } = med(n);
  const yc = y + AH / 2 + 8;
  if (esHoja(n)) {
    const { neg, flanco, v } = partes(n);
    const nombre = prog.vars[v]?.[0]?.replace(/\s*\(cerrado\)/, '') ?? '';
    const cx = x + AW / 2;
    return `<g data-r="${ruta}" class="l-hoja"><path class="l-w l-in" d="M${x} ${yc}H${cx - 11}"/><path class="l-w l-out" d="M${cx + 11} ${yc}H${x + w}"/>
      <path class="l-c" d="M${cx - 11} ${yc - 15}V${yc + 15}M${cx + 11} ${yc - 15}V${yc + 15}"/>${neg ? `<path class="l-c" d="M${cx - 16} ${yc + 15}L${cx + 16} ${yc - 15}"/>` : ''}${flanco ? `<text x="${cx}" y="${yc + 5}" class="l-p" text-anchor="middle">P</text>` : ''}
      <text x="${cx}" y="${yc - 22}" class="l-a" text-anchor="middle">${h(dir(v, modo))}</text><text x="${cx}" y="${yc + 31}" class="l-n" text-anchor="middle">${h(nombre.slice(0, 16))}</text></g>`;
  }
  const [t, ...hs] = n; let s = '';
  if (t === 's') {
    let cx = x;
    hs.forEach((c, i) => {
      const m = med(c);
      s += dibujar(c, cx, y, `${ruta}.${i}`, prog, modo); cx += m.w;
    });
    if (cx < x + w) s += `<path class="l-w" data-r2="${ruta}" d="M${cx} ${yc}H${x + w}"/>`;
    return s;
  }
  let cy = y; const ys = [];
  hs.forEach((c, i) => {
    const m = med(c); const yr = cy + AH / 2 + 8; ys.push(yr);
    s += `<path class="l-w" data-r3="${ruta}.${i}" data-lado="i" d="M${x} ${yr}H${x + 12}"/>`;
    s += dibujar(c, x + 12, cy, `${ruta}.${i}`, prog, modo);
    s += `<path class="l-w" data-r3="${ruta}.${i}" data-lado="d" d="M${x + 12 + m.w} ${yr}H${x + w}"/>`;
    cy += m.h;
  });
  s += `<path class="l-w" data-r3b="${ruta}" data-lado="i" d="M${x} ${ys[0]}V${ys[ys.length - 1]}"/><path class="l-w" data-r3b="${ruta}" data-lado="d" d="M${x + w} ${ys[0]}V${ys[ys.length - 1]}"/>`;
  return s;
}
function salidaSvg(o, i, k, x, y, prog, modo, ancho) {
  const yc = y + AH / 2 + 8; const nombre = prog.vars[o.v]?.[0] ?? '';
  const id = `${i}:o${k}`;
  const hilo = `<path class="l-w" data-o="${id}" d="M${x} ${yc}H${x + 22}"/>`;
  const a = dir(o.v, modo);
  if (o.t === 'ton' || o.t === 'ctu') {
    const titulo = o.t === 'ton' ? 'TON' : 'CTU';
    const det = o.t === 'ton' ? `PT ${o.ms / 1000} s` : `PV ${o.pv}`;
    return `${hilo}<rect class="l-bloque" data-o="${id}" x="${x + 22}" y="${yc - 30}" width="104" height="60" rx="10"/><text x="${x + 74}" y="${yc - 9}" class="l-a" text-anchor="middle">${titulo} ${h(a)}</text><text x="${x + 74}" y="${yc + 8}" class="l-n" text-anchor="middle">${det}</text><text x="${x + 74}" y="${yc + 23}" class="l-n l-val" data-val="${h(o.v)}" text-anchor="middle"></text>`;
  }
  const letra = { bobina: '', set: 'S', reset: 'R' }[o.t];
  const cx = x + 56;
  return `${hilo}<path class="l-w" data-o="${id}" d="M${x + 22} ${yc}H${cx - 18}"/><ellipse class="l-coil" data-o="${id}" cx="${cx}" cy="${yc}" rx="18" ry="15"/><text x="${cx}" y="${yc + 5}" class="l-p" text-anchor="middle">${letra}</text><text x="${cx}" y="${yc - 22}" class="l-a" text-anchor="middle">${h(a)}</text><text x="${cx}" y="${yc + 31}" class="l-n" text-anchor="middle">${h(nombre.slice(0, 16))}</text>`;
}
// SVG de todo el programa. Sirve tanto para el simulador como para una diapositiva.
export function svgPrograma(prog, modo = 's7') {
  const anchoC = Math.max(...prog.redes.map((r) => med(r.c).w));
  const W = 20 + anchoC + OW + 26; let y = 0, cuerpo = '';
  prog.redes.forEach((r, i) => {
    const m = med(r.c);
    const altoS = r.o.length * AH;
    const alto = Math.max(m.h, altoS) + 34;
    cuerpo += `<text x="20" y="${y + 18}" class="l-t">Segmento ${i + 1}: ${h(r.txt)}</text>`;
    const y0 = y + 24;
    const yc = y0 + AH / 2 + 8;
    cuerpo += `<path class="l-w l-on" d="M6 ${yc}H20"/>`;
    cuerpo += dibujar(r.c, 20, y0, `${i}`, prog, modo);
    const xFin = 20 + m.w;
    cuerpo += `<path class="l-w" data-o="${i}:o0" d="M${xFin} ${yc}H${20 + anchoC}"/>`;
    r.o.forEach((o, k) => {
      if (k) cuerpo += `<path class="l-w" data-o="${i}:o0" d="M${20 + anchoC} ${yc}V${yc + k * AH}"/>`;
      cuerpo += salidaSvg(o, i, k, 20 + anchoC, y0 + k * AH, prog, modo);
    });
    cuerpo += `<rect class="l-riel" x="2" y="${y + 26}" width="5" height="${alto - 28}" rx="2.5"/>`;
    y += alto + 8;
  });
  return `<svg class="ladder" viewBox="0 0 ${W} ${y}" role="img" aria-label="Programa en Ladder: ${h(prog.titulo)}">${cuerpo}</svg>`;
}
// Colorea el programa según por dónde pasa la corriente en este ciclo.
export function pintarFlujo(svg, sim) {
  for (const n of svg.querySelectorAll('[data-r]')) {
    const f = sim.flujo[n.dataset.r]; if (!f) continue;
    n.querySelector('.l-in').classList.toggle('l-on', f.entra);
    n.querySelector('.l-out').classList.toggle('l-on', f.sale);
    n.classList.toggle('l-cerrado', f.entra && f.cierra);
    n.querySelectorAll('.l-c').forEach((c) => c.classList.toggle('l-on', !!f.cierra));
  }
  for (const n of svg.querySelectorAll('[data-r2]')) n.classList.toggle('l-on', !!sim.flujo[n.dataset.r2]?.sale);
  for (const n of svg.querySelectorAll('[data-r3]')) {
    const f = sim.flujo[n.dataset.r3];
    n.classList.toggle('l-on', !!(n.dataset.lado === 'i' ? f?.entra : f?.sale));
  }
  for (const n of svg.querySelectorAll('[data-r3b]')) {
    const f = sim.flujo[n.dataset.r3b];
    n.classList.toggle('l-on', !!(n.dataset.lado === 'i' ? f?.entra : f?.sale));
  }
  for (const n of svg.querySelectorAll('[data-o]')) n.classList.toggle('l-on', !!sim.flujo[n.dataset.o]);
  for (const n of svg.querySelectorAll('[data-val]')) {
    const v = n.dataset.val;
    n.textContent = v in sim.t ? `${(sim.t[v] / 1000).toFixed(1)} s` : v in sim.c ? `Cuenta: ${sim.c[v]}` : '';
  }
}
