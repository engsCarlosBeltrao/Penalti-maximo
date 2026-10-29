# PÊNALTI MÁXIMO
**Executar:** abra a pasta no VS Code → botão direito em `index.html` → *Open with Live Server*. Alternativa sem servidor: `jogar.html` (usa `bundle.js`; regenere com `bash build_bundle.sh` após editar os módulos). Testes de lógica: `node test.mjs`.

## Controles
A linha amarela oscila sozinha: clique e solte = chute rasteiro naquela posição; segure = o marcador de altura sobe (a linha continua se movendo); solte para chutar. M = silenciar. Defesa no modo "sozinho": ← ↑ →. `☰ MENU` volta ao menu a qualquer momento.

## Módulos
`teams.js` (20 clubes) · `players.js` (elencos) · `advertising.js` · `musicPlaylist.js`/`musicPlayer.js` · `game.js` (estados, bola, goleiro, regras) · `render.js` · `aim.js` · `tournament.js` · `gameState.js`/`events.js`/`arduino.js` · `audio.js` · `main.js` (menus).

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

## Bola
`js/ball.js` desenha uma bola INSPIRADA no visual da bola Nike/CBF do Brasileirão (branca, painéis azuis, toques verdes; referência 2023). NÃO é a textura oficial e a bola da temporada atual não foi identificada em fonte confiável. Para usar uma textura licenciada, substitua `drawBall`.

## Personagens e comemorações
`js/characters.js`: cobrador (de costas, nome/número) e goleiro (de frente, luvas, rosto) articulados em Canvas 2D. Durante a disputa só há reação individual discreta; a comemoração de vitória (e a decepção do derrotado) só ocorre depois do resultado final confirmado (`Game.fin`), uma única vez.

## Decisões técnicas
Mantido Canvas 2D (Three.js exigiria biblioteca externa, reescrita de toda a cena e modelos 3D que não temos). Passo de física fixo (120 Hz), câmera com suavização exponencial, tremor e antecipação; áudio com master + limitador e volumes em dB.

## Testes
`node test.mjs` (lógica do jogo, 53) · `node test_music.mjs` (links, persistência, gerenciador com player FALSO, 57).

## Cena 3D (motor próprio, sem dependências)
O Three.js não está disponível no ambiente de desenvolvimento (sem cópia local e sem internet), então a cena é renderizada por um motor 3D próprio em Canvas (`js/engine3d.js`): câmera em perspectiva real, projeção 3D, ordenação por profundidade e primitivas. `js/rig.js` tem o esqueleto articulado (cinemática direta + inversa de 2 ossos) e as poses; `js/scene3d.js` monta estádio, gol, rede, bola, personagens e câmera; `js/hud.js` desenha o placar por cima.
- **Cobrador:** 2 passos de aproximação (0,55 s), pé de apoio, recuo da perna, golpe com IK até a bola (chuteira a ≤ 0,2 m do centro da bola no instante do contato), acompanhamento e recuperação. A bola só parte no contato.
- **Goleiro:** espera com passinhos e joelhos flexionados; 4 defesas distintas (alta, média, baixa, central) escolhidas pela trajetória real; braços por IK em direção à estimativa do goleiro (na defesa, à bola; no gol, ao ponto errado); queda e recuperação até a posição inicial.
- **Camisas:** nome e número desenhados numa textura mapeada no tecido (peito/costas), não flutuam.
- **Arquibancada 3D** logo atrás da linha de fundo (≈ 800 torcedores em 11 degraus), faixas, bandeiras, mosaico, fumaça e sinalizadores nas cores dos clubes.
- Para trocar por Three.js no futuro, basta substituir `scene3d.js` (a lógica do jogo não depende do renderizador).
Testes: `node test_rig.mjs` (18).

## Modelos (o que é o quê)
- **Geometria procedural (implementado):** não há modelos GLB/glTF nem Three.js neste ambiente (sem internet e sem arquivos). `js/athlete.js` constrói cada atleta com malhas procedurais: tronco cilíndrico de 12 facetas com a camisa mapeada ao redor (nome e número estampados curvam com o corpo e ficam ocultos quando um braço passa na frente), shorts em malha, membros afilados com sombreamento (coxa, panturrilha, meião com faixa, chuteira com detalhe), ombros, mãos/luvas, pescoço e cabeça elipsoidal. Aparência única por atleta (`faceOf`): tom de pele (6), cabelo (7 cores, 7 estilos), porte, altura, olhos, nariz, sobrancelhas, boca e orelhas.
- **Rosto e cabelo:** olhos, sobrancelhas, nariz, boca e orelhas são desenhados em 2D sobre pontos 3D da cabeça (aparecem só quando virada para a câmera; de perfil, aparecem de lado); o cabelo é formado por formas 2D com gradiente, não por malha 3D.
- **Torcida (`js/crowd.js`):** ~900 pessoas posicionadas em degraus 3D, cada uma com corpo, cabeça, cabelo, roupa e pose próprios (sentado, em pé, aplaudindo, braços erguidos, mãos na cabeça, bandeira, boné, cachecol), mas desenhadas como figuras 2D em profundidade (billboards), não como modelos 3D. Em repouso usam sprites pré-renderizados; ao reagir, são desenhadas ao vivo.
- **Escudo na camisa:** a imagem oficial só é usada se existir `assets/crests/<key>.png` e a key estiver em `CRESTS` (teams.js); sem ela aparece um escudo genérico com a sigla (provisório).
- **Para ter modelos reais:** forneça `three.module.min.js` (r160+) e arquivos `.glb` de jogador com esqueleto e animações; `scene3d.js` pode ser substituído mantendo `rig.js` (poses) como referência de timing.
Desempenho: o fundo estático é guardado em cache enquanto a câmera está parada (mira).

## Modelos 3D reais (Three.js + GLB) — preparado, ainda desativado
Leia `INTEGRACAO_3D.md` (versão, caminhos, contrato do modelo, animações, uniformes, arquivos que faltam e situação dos testes). Validadores: `node tools/inspect-glb.mjs <arquivo.glb>`, `node tools/check-3d-setup.mjs`; todos os testes: `node tools/run-all-tests.mjs`. O motor atual continua sendo o padrão; o Three.js só é usado com `index.html?engine=three` (Live Server).
