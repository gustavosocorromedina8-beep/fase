#!/usr/bin/env python3
"""Genera archivos.js con todo lo que la app guarda para funcionar sin conexión.
Ejecútalo cada vez que cambies archivos de la app; la versión se calcula sola."""
import hashlib, json, os
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCLUIR = {'scripts', '.claude', '.git', '.taste-skill'}
FUERA = {'sw.js', 'archivos.js', 'Abrir Fase.command', 'LEEME.md'}
lista, huella = ['./'], hashlib.sha256()
for base, dirs, nombres in sorted(os.walk(RAIZ)):
    dirs[:] = sorted(d for d in dirs if d not in EXCLUIR)
    for n in sorted(nombres):
        if n.startswith('.') or n in FUERA: continue
        ruta = os.path.join(base, n)
        lista.append(os.path.relpath(ruta, RAIZ).replace(os.sep, '/'))
        huella.update(open(ruta, 'rb').read())
with open(os.path.join(RAIZ, 'archivos.js'), 'w') as f:
    f.write(f"self.VERSION={json.dumps(huella.hexdigest()[:12])};\nself.ARCHIVOS={json.dumps(lista, ensure_ascii=False)};\n")
print(len(lista), 'archivos')
