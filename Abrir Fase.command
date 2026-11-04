#!/bin/zsh
# Doble clic para abrir Fase en este Mac. Deja esta ventana abierta mientras la usas.
cd "$(dirname "$0")"
(sleep 1; open "http://localhost:8123/") &
python3 scripts/servidor.py 8123
