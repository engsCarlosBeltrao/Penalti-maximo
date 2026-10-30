# PÊNALTI MÁXIMO
**Executar:** clique duas vezes em `iniciar.bat` (precisa do Node.js; abre o navegador sozinho) — ou abra a pasta no VS Code → botão direito em `index.html` → *Open with Live Server*. O jogo é **3D (Three.js + modelos GLB)** e não abre direto do disco (`file://`): o navegador bloqueia os módulos e o modelo. Todos os testes: `node tools/run-all-tests.mjs`.

> **Regra do projeto:** o jogo é exclusivamente 3D. Toda funcionalidade visual ou de jogabilidade nova é feita no motor Three.js (`js/three/`) — não existe mais motor 2D.

## Controles
A linha amarela oscila sozinha: clique e solte = chute rasteiro naquela posição; segure = o marcador de altura sobe (a linha continua se movendo); solte para chutar. M = silenciar. Defesa no modo "sozinho": ← ↑ →. `☰ MENU` volta ao menu a qualquer momento.

## Módulos
`teams.js` (20 clubes) · `players.js` + `lineups/` (elencos e aparência real dos titulares) · `advertising.js` · `musicPlaylist.js`/`musicPlayer.js` · `game.js` (estados, bola, goleiro, regras) · `aim.js` · `tournament.js` · `gameState.js`/`events.js`/`arduino.js` · `audio.js` · `main.js` (menus) · `frame.js` + `rig.js` (o que aparece em cada quadro: poses, bola, câmera) · `hud.js` (placar e mira, desenhados por cima do 3D) · `three/` (motor 3D).

## Como adicionar músicas
Coloque arquivos **autorizados** em `assets/music/` e registre em `js/musicPlaylist.js` (`{id,title,artist,src,enabled}`). Lista vazia = jogo normal. Arquivo ausente gera mensagem na tela Playlist e a faixa é pulada.

## Como cadastrar anúncios
Edite a lista `ADS` em `js/advertising.js` (sponsor, text, image, backgroundColor, textColor, duration, priority, boardGroup, enabled). Imagens em `assets/ads/`; sem imagem, a placa mostra o texto. `priority >= 100` = destaque (aparece 2x por ciclo). A Faculdade Campo Real já está configurada (`assets/ads/campo-real.png` ainda precisa ser fornecida; o slogan é só sugestão).

## Escudos
Coloque `assets/crests/<key>.png` (keys em `teams.js`, ex.: `flamengo.png`). Sem arquivo aparece um selo neutro com a sigla. Os uniformes são estilizados, não réplicas oficiais.

## Elencos (`js/players.js`)
Cada jogador tem `source` e `verifiedAt`. `jerseyNumber: null` = vínculo confirmado, camisa NÃO confirmada (aparece "?"). Clubes sem dados confirmados usam 5 cobradores "ATLETA" provisórios (não são pessoas reais).
Confirmados em 13/10/2026 (ver fonte em cada registro): **Fluminense** 32 (numeração oficial de 14/01/2026, via Netflu — posições e transferências posteriores não verificadas), **Athletico-PR** 11 (lista parcial, Bem Paraná), **Flamengo** 9 com números (Arrascaeta 10, Pedro 9, Paquetá 11, Rossi 1, Léo Pereira 4, Jorginho 21, Danilo 13, Varela 2, Carrascal 15 — duas fontes, 28/10/2026), **Santos** 2 (Neymar 10, Gabigol 9), **Corinthians** 1 (Memphis Depay, camisa 10 segundo fontes de 2025). **Pendentes: os outros 14 clubes.** `isStar` e `rating` são critérios do projeto; `appearance` é estilização genérica, não retrato.
Para completar um clube: acrescente `[número, 'Nome', {pos, star, r, cel}]` na lista dele (ou crie `...L('palmeiras','fonte',[...])`) e registre a fonte em `SRC`.

## Áudio
`soundEffects.js` (receitas sintetizadas originais) + `audio.js` (mixer). Três volumes independentes em Configurações: efeitos, torcida (ambiente e reações) e música. Para usar arquivos próprios, coloque em `assets/sfx/` e liste em `SFX_FILES` (ex.: `{ gol: 'assets/sfx/gol.mp3' }`). Nenhum arquivo de áudio é fornecido.

## Músicas e Torcidas (YouTube) — tudo pelo jogo
Menu → **MÚSICAS E TORCIDAS** (4 abas): *Playlist do Menu* (vários links, nome, ativar, ordem ▲▼, substituir, excluir, tocar/pausar/anterior/próxima, aleatório, repetir), *Cantos das Torcidas* (um link por clube dos 20 do jogo, volume e teste), *Canto do Campeão* (canto da equipe vencedora · link exclusivo · música padrão · desligado) e *Volume e Reprodução* (volume geral, quando o canto começa: apresentação/preparação/chute/gol, abaixar música no chute, restaurar/limpar).
Aceita links `youtube.com/watch`, `youtu.be`, `shorts`, `embed`, `music.youtube.com` (com `&t=`/`?t=`) e ID puro de 11 caracteres; qualquer outro domínio é recusado. Tudo é salvo no `localStorage` (valida e descarta dados inválidos).
Um único player oficial (IFrame API) é reutilizado; prioridades: teste > campeão > canto > playlist. O canto vem do estado real da partida (evento `cobranca_mudou`, `GS.equipes[cobrador].key`); o do campeão só toca em `partida_encerrada` com vencedor válido.
**Limitações externas:** o YouTube pode bloquear incorporação (erros 101/150), vídeos removidos/privados (100) ou autoplay — o painel mostra a mensagem e o botão "Abrir no YouTube". Requer internet e abrir por **http** (Live Server); por `file://` o YouTube recusa (mensagem explica). O player precisa ficar visível (200×200, canto inferior direito) enquanto toca, por regra do YouTube. O áudio só inicia depois do 1º toque/clique. Links de playlist inteira (sem vídeo) não são aceitos.

## Escudos, logotipo e anúncios
Escudos: salve `assets/crests/<key>.png` e acrescente a key em `CRESTS` (`teams.js`). Logotipo da Campo Real: salve `assets/ads/campo-real.png` e troque `image:''` por `image:'assets/ads/campo-real.png'` em `advertising.js`. Sem os arquivos o jogo usa selo neutro/texto, sem erros no console.

## Integração futura com Arduino
Placar/estado: `JOGO.GS` (`gameState.js`); LCD: `getLcd()`. Eventos (`Events.on('gol', fn)` ou `'*'`): `partida_iniciada, gol, defesa, fora, trave, placar_alterado, cobranca_mudou, partida_encerrada, vitoria, derrota, partida_reiniciada` — emitidos uma vez por cobrança, após a resolução. A comunicação serial deve ser feita em `js/arduino.js`; comandos externos usam `Arduino.comando('iniciar'|'pausar'|'reiniciar')`. Nada disso é necessário para jogar.

## Motor 3D (Three.js r160 + GLB)
- **Como se encaixa:** `game.js` decide o que acontece; `frame.js`/`rig.js` descrevem cada quadro (quem aparece, poses, bola, câmera); `js/three/engine.js` desenha esse quadro e registra-se em `renderer.js`. O placar e a mira (`hud.js`) são desenhados num canvas transparente por cima do WebGL, que também recebe o clique do chute.
- **Jogadores:** `assets/models/athlete.glb` (um modelo para todos), instanciado por `three/loader.js`; poses do `rig.js` aplicadas por retargeting (`three/retarget.js`). Cada atleta recebe uniforme do clube (`three/uniform.js` + `assets/kits/`), tom de pele, cabelo, barba, bigode, costeleta e faixa próprios (`lineups/appearance.js`, shader em `three/hairMaterial.js`).
- **Em cena:** cobrador, goleiro do adversário (`keeperOf`), e no fim 3 companheiros comemorando e 1 adversário desanimado.
- **Estádio:** `three/stadium.js` (gramado, gol com rede deformável, bola, placas de anúncio, arquibancada e ~900 torcedores em sprites gerados por `crowd.js`) e `three/stadiumFx.js` (faixas com texto, bandeiras, sinalizadores, fumaça e refletores).
- **Se não abrir:** sem WebGL, sem servidor ou com arquivo faltando, aparece o motivo na tela e um botão "tentar de novo". Diagnóstico: `node tools/check-3d-setup.mjs` e `three-smoke.html`.
- **Depuração:** `JOGO.GS` (estado), `JOGO.Events`, `JOGO.Game`, `JOGO.DBG.cam = { pos, tgt, fov }` (câmera fixa) e `JOGO.DBG.fx` (efeitos da arquibancada).
- **Bola:** textura gerada em `three/stadium.js`, inspirada no visual da bola do Brasileirão — não é a textura oficial.
- **Comemorações:** a comemoração de vitória (e a decepção do derrotado) só ocorre depois do resultado final confirmado (`Game.fin`), uma única vez.

## Testes
`node tools/run-all-tests.mjs` roda as 11 suítes: lógica do jogo, músicas, rig, quadro, retargeting, GLB, preparação de modelo, instalação, estruturas de pasta, uniformes e elencos/aparências/cabelos.

## Modelos e uniformes
Detalhes do modelo (contrato, materiais, biblioteca de cabelo): `assets/models/LEIA-ME.md` e `INTEGRACAO_3D.md`. Uniformes do pack: `assets/kits/LEIA-ME.md`. Validadores: `node tools/inspect-glb.mjs <arquivo.glb>`, `node tools/check-3d-setup.mjs`.
