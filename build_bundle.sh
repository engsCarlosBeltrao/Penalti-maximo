#!/bin/bash
# Gera bundle.js (versão sem módulos, abre com clique duplo em jogar.html). Módulos com nomes internos próprios são isolados em funções.
cd "$(dirname "$0")"
strip() { sed -E '/^import /d; s/^export (const|class|function) /\1 /' "js/$1.js"; }
wrap() { f=$1; shift; echo "const {$*}=(function(){"; strip $f; echo "return {$*};})();"; }
{ echo "(function(){"
  for f in renderer teams $(cd js; ls lineups/clubs/*.js | sed "s/\.js$//") lineups/appearance lineups/lineups players advertising musicPlaylist musicPlayer soundEffects events gameState aim tournament arduino; do strip $f; echo; done
  wrap ytUtil parseYouTube,watchUrl; wrap settingsStore Store,uid,sanitize,defaults,cleanEntry; wrap audioManager AM
  echo "const {drawScene,setTeams,DBG}=(function(){"; for f in vec face shirtTex engine3d rig hud ball athlete crowd frame scene3d; do strip $f; echo; done; echo "return {drawScene,setTeams,DBG};})();"
  for f in audio game; do strip $f; echo; done
  wrap musicPanel openMusicPanel; strip main
  echo "})();"; } > bundle.js
node --check bundle.js && echo bundle-ok
