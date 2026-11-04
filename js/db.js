// Almacenamiento local: presentaciones, fotos y ajustes se quedan en el dispositivo.
let conexion;
function abrir() {
  return (conexion ??= new Promise((ok, mal) => {
    const r = indexedDB.open('fase', 2);
    r.onupgradeneeded = () => { for (const a of ['clases', 'fotos', 'examenes']) if (!r.result.objectStoreNames.contains(a)) r.result.createObjectStore(a, { keyPath: 'id' }); };
    r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
  }));
}
async function tx(almacen, modo, fn) {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const t = db.transaction(almacen, modo); const r = fn(t.objectStore(almacen));
    t.oncomplete = () => ok(r?.result); t.onerror = () => mal(t.error); t.onabort = () => mal(t.error);
  });
}
export const guardar = (a, v) => tx(a, 'readwrite', (s) => s.put(v));
export const leer = (a, id) => tx(a, 'readonly', (s) => s.get(id));
export const todos = (a) => tx(a, 'readonly', (s) => s.getAll());
export const borrar = (a, id) => tx(a, 'readwrite', (s) => s.delete(id));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const ajustes = {
  leer(k, d) { try { return JSON.parse(localStorage.getItem('fase.' + k)) ?? d; } catch { return d; } },
  poner(k, v) { localStorage.setItem('fase.' + k, JSON.stringify(v)); },
};
