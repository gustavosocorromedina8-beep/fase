// Apartado de PLC: elige un programa, acciona sus entradas y mira cómo circula la corriente.
import { h } from './app.js';
import { PROGRAMAS, programa, Simulador, svgPrograma, pintarFlujo, aLogo } from './plc.js';
import { TEMARIO } from './temario.js';
import { fichaHtml } from './dudas.js';
const FICHAS = TEMARIO.filter((f) => f.bloque === 'PLC y Ladder');

export function vistaPlc(raiz, id) {
  let prog = programa(id) ?? PROGRAMAS[4]; let modo = 's7'; let reloj = null; let sim;
  raiz.innerHTML = `<section class="seccion" data-hilo="amarillo">
    <header class="cabeza"><h1>PLC</h1><p>Programas en Ladder (KOP) que puedes probar: acciona las entradas y mira por dónde pasa la corriente.</p></header>
    <div class="plc-sel"><label for="prog">Programa</label><select id="prog" class="campo">${PROGRAMAS.map((p) => `<option value="${p.id}" ${p.id === prog.id ? 'selected' : ''}>${h(p.titulo)}</option>`).join('')}</select>
      <div class="segmento" role="group" aria-label="Direcciones"><button type="button" data-modo="s7" aria-pressed="true">TIA Portal</button><button type="button" data-modo="logo" aria-pressed="false">LOGO!</button></div></div>
    <div data-sim></div>
    <section class="bloque plc-teoria"><h2>Teoría de PLC</h2>${FICHAS.map((f) => `<details class="tema-item"><summary>${h(f.titulo)}</summary>${fichaHtml(f)}<p class="fuente">Fuente: ${h(f.fuente)}</p></details>`).join('')}</section>
  </section>`;
  const zona = raiz.querySelector('[data-sim]');
  const nombreV = (v) => (modo === 'logo' ? aLogo(v) : `%${v}`);
  function montar() {
    clearInterval(reloj);
    sim = new Simulador(prog);
    const v = Object.entries(prog.vars);
    const ent = v.filter(([k]) => k.startsWith('I'));
    const sal = v.filter(([k]) => k.startsWith('Q'));
    zona.innerHTML = `<div class="plc-panel">
      <div class="plc-inf"><h2>${h(prog.titulo)}</h2><p>${h(prog.desc)}</p><p class="plc-prueba"><strong>Pruébalo:</strong> ${h(prog.prueba)}</p></div>
      <div class="plc-mando"><div class="plc-grupo"><h3>Entradas</h3>${ent.map(([k, d]) => `<button type="button" class="ent" data-v="${k}" data-tipo="${d[1]}"><span class="led"></span><span><strong>${h(nombreV(k))}</strong>${h(d[0])}</span></button>`).join('')}</div>
      <div class="plc-grupo"><h3>Salidas</h3>${sal.map(([k, d]) => `<div class="sal" data-s="${k}"><span class="led"></span><span><strong>${h(nombreV(k))}</strong>${h(d[0])}</span></div>`).join('')}</div>
      <button type="button" class="btn" data-reinicia>Reiniciar</button></div>
      <div class="plc-ladder" data-lad>${svgPrograma(prog, modo)}</div></div>`;
    const svg = zona.querySelector('svg');
    zona.querySelectorAll('.ent').forEach((b) => {
      const v0 = b.dataset.v; const tipo = b.dataset.tipo;
      const pintar = () => b.toggleAttribute('data-on', !!sim.mem[v0]);
      if (tipo === 'interruptor') { b.onclick = () => { sim.poner(v0, !sim.mem[v0]); pintar(); }; b.setAttribute('aria-pressed', 'false'); }
      else {
        const reposo = tipo === 'nc';
        const baja = (e) => { e.preventDefault(); try { b.setPointerCapture?.(e.pointerId); } catch {} sim.poner(v0, !reposo); b.toggleAttribute('data-pulsado', true); pintar(); };
        const sube = () => { sim.poner(v0, reposo); b.removeAttribute('data-pulsado'); pintar(); };
        b.onpointerdown = baja; b.onpointerup = sube; b.onpointercancel = sube; b.onlostpointercapture = sube;
        b.onkeydown = (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) baja(e); }; b.onkeyup = (e) => { if (e.key === ' ' || e.key === 'Enter') sube(); };
      }
      pintar();
    });
    zona.querySelector('[data-reinicia]').onclick = montar;
    let antes = performance.now();
    const tick = () => {
      const a = performance.now(); sim.ciclo(a - antes); antes = a;
      pintarFlujo(svg, sim);
      zona.querySelectorAll('[data-s]').forEach((n) => n.toggleAttribute('data-on', !!sim.mem[n.dataset.s]));
    };
    tick(); reloj = setInterval(tick, 60);
  }
  raiz.querySelector('#prog').onchange = (e) => { prog = programa(e.target.value); montar(); };
  raiz.querySelectorAll('[data-modo]').forEach((b) => { b.onclick = () => { modo = b.dataset.modo; raiz.querySelectorAll('[data-modo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); montar(); }; });
  montar();
  return () => clearInterval(reloj);
}
