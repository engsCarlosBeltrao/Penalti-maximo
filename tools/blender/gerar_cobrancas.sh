#!/usr/bin/env bash
# Gera todos os clipes de cobrança (estilo × tipo) com o Blender, 3 processos por vez, e monta js/kickClips.js.
# Uso: BLENDER_EXE="C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" bash tools/blender/gerar_cobrancas.sh [saida=assets/models/anim] [estilo_tipo ...]
set -e
cd "$(dirname "$0")/../.."
B="${BLENDER_EXE:-C:/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
OUT="${1:-assets/models/anim}"; shift || true
LIST="${*:-comum_chapada comum_medio comum_bomba neymar_chapada neymar_medio neymar_bomba gabigol_chapada gabigol_medio gabigol_bomba jorginho_chapada jorginho_medio jorginho_bomba arrascaeta_chapada arrascaeta_medio arrascaeta_bomba}"
LOGS="${LOGS:-$(mktemp -d)}"; mkdir -p "$LOGS"
run() { local e="${1%_*}" t="${1##*_}"; "$B" -b --factory-startup --python-exit-code 1 -P tools/blender/cobranca.py -- assets/models/athlete.glb "$OUT" .claude/skills "$e" "$t" > "$LOGS/$1.log" 2>&1 && echo "ok $1" || { echo "FALHOU $1 (ver $LOGS/$1.log)"; return 1; }; }
pids=(); n=0; fail=0
for c in $LIST; do run "$c" & pids+=($!); n=$((n+1)); if [ $((n % 3)) -eq 0 ]; then for p in "${pids[@]}"; do wait "$p" || fail=1; done; pids=(); fi; done
for p in "${pids[@]}"; do wait "$p" || fail=1; done
node tools/build-kick-clips.mjs "$OUT"
exit $fail
