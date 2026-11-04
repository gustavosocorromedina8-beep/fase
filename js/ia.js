// IA local: el modelo se descarga una vez y después se ejecuta en el dispositivo con WebGPU.
import { ajustes } from './db.js';
export const MODELOS = {
  ligero: { id: 'gemma3-1b-it-q4f16_1-MLC', nombre: 'Ligero', peso: 'unos 700 MB', para: 'iPhone y iPad' },
  mejor: { id: 'gemma-2-2b-it-q4f16_1-MLC-1k', nombre: 'Mejor', peso: 'unos 1,6 GB', para: 'Mac' },
  f32: { id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', nombre: 'Compatible', peso: 'unos 1,1 GB', para: 'sin soporte f16' },
};
const estado = { fase: 'apagada', progreso: 0, texto: '', modelo: null, error: null };
const oyentes = new Set();
let motor = null;
function avisar(cambios) { Object.assign(estado, cambios); oyentes.forEach((f) => f({ ...estado })); }
export const ia = {
  get estado() { return { ...estado }; },
  get lista() { return estado.fase === 'lista'; },
  oir(f) { oyentes.add(f); f({ ...estado }); return () => oyentes.delete(f); },
  async soporte() {
    if (!navigator.gpu) return { ok: false, motivo: 'Este navegador no tiene WebGPU. En iPhone necesitas iOS 26 o posterior, con Safari.' };
    try {
      const a = await navigator.gpu.requestAdapter();
      if (!a) return { ok: false, motivo: 'No se ha podido acceder a la tarjeta gráfica del dispositivo.' };
      return { ok: true, f16: a.features.has('shader-f16') };
    } catch (e) { return { ok: false, motivo: e.message }; }
  },
  modeloElegido(s) {
    const movil = /iPhone|iPad|Android/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
    const k = ajustes.leer('modelo', movil ? 'ligero' : 'mejor');
    return s && !s.f16 ? 'f32' : k;
  },
  // Si la página se recargó mientras cargaba el modelo, el sistema la cerró por falta de memoria.
  cierreAnterior() { return ajustes.leer('cargando', null); },
  async encender(clave) {
    if (estado.fase === 'cargando' || estado.fase === 'lista') return;
    const s = await this.soporte();
    if (!s.ok) return avisar({ fase: 'error', error: s.motivo });
    const k = clave ?? this.modeloElegido(s);
    const m = MODELOS[s.f16 ? k : 'f32'];
    avisar({ fase: 'cargando', progreso: 0, texto: 'Preparando…', modelo: k, error: null });
    ajustes.poner('cargando', k);
    try {
      navigator.storage?.persist?.();
      const { CreateWebWorkerMLCEngine } = await import('../vendor/web-llm.js');
      const w = new Worker(new URL('./ia.worker.js', import.meta.url), { type: 'module' });
      motor = await CreateWebWorkerMLCEngine(w, m.id, {
        initProgressCallback: (p) => avisar({ progreso: p.progress ?? 0, texto: p.text ?? '' }),
      });
      ajustes.poner('cargando', null); ajustes.poner('iaActiva', k);
      avisar({ fase: 'lista', progreso: 1, texto: '' });
    } catch (e) {
      ajustes.poner('cargando', null); motor = null;
      const sinRed = !navigator.onLine;
      avisar({ fase: 'error', error: sinRed ? 'El modelo aún no está descargado. Conéctate a internet una vez para descargarlo.' : `No se ha podido cargar la IA: ${e.message}` });
    }
  },
  async apagar() {
    try { await motor?.unload(); } catch {}
    motor = null; ajustes.poner('iaActiva', null); avisar({ fase: 'apagada', progreso: 0, texto: '' });
  },
  async *responder(mensajes, opciones = {}) {
    if (!motor) throw new Error('IA apagada');
    const flujo = await motor.chat.completions.create({ messages: mensajes, stream: true, temperature: opciones.temperatura ?? 0.3, max_tokens: opciones.max ?? 450, repetition_penalty: 1.15 });
    for await (const c of flujo) { const t = c.choices[0]?.delta?.content; if (t) yield t; }
  },
  async json(mensajes, max = 350) {
    if (!motor) throw new Error('IA apagada');
    let txt = '';
    for await (const t of this.responder(mensajes, { temperatura: 0.2, max })) txt += t;
    const m = txt.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : txt);
  },
  parar() { try { motor?.interruptGenerate(); } catch {} },
};
