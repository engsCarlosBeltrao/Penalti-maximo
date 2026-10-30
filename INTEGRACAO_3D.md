# Integração de modelos 3D reais (Three.js + GLB) — Pênalti Máximo

**Estado:** o motor Three.js/GLB é o **único motor do jogo** (o motor procedural 2D foi removido em 2026-10). O `index.html` abre direto nele; se faltar WebGL, servidor ou arquivo, o jogo mostra o motivo e a opção de tentar de novo.

## 1. Versão do Three.js
**Three.js r160 (`three@0.160.0`).** Motivos:
- `build/three.module.js` é um **arquivo único** (a divisão em `three.core.js` começa em r17x), então bastam 4 arquivos locais.
- O projeto não tem bundler. O Three.js é carregado como **módulo ES via `importmap`** (no `index.html`), o que exige abrir por **http**: `iniciar.bat` (servidor `tools/servidor.mjs`) ou Live Server. Não há mais versão para abrir com clique duplo (`file://`).
- Faixa tolerada: r150–r169 com os mesmos arquivos; r170+ exige também `vendor/three/three.core.js`.
- ⚠ Esta compatibilidade vem do meu conhecimento da biblioteca; **não foi confirmada por download** (o ambiente não tem internet). `node tools/check-3d-setup.mjs` lê a revisão do arquivo e confirma na sua máquina.

## 2. Caminhos exatos da dependência
Veja `vendor/three/LEIA-ME.md` (comandos prontos). Arquivos:
```
vendor/three/three.module.js
vendor/three/addons/loaders/GLTFLoader.js
vendor/three/addons/utils/BufferGeometryUtils.js
vendor/three/addons/utils/SkeletonUtils.js
```
Modelos: `assets/models/athlete.glb` (obrigatório), `assets/models/goalkeeper.glb` (opcional), `assets/models/uniform-layout.json` e `skeleton-map.json` (opcionais).

## 3. O que o modelo precisa ter
Contrato completo em `assets/models/LEIA-ME.md`: GLB sem compressão; metros; olha para +Z, lado esquerdo em +X; T/A-pose; 22 ossos (nomes Mixamo/Unity/Blender reconhecidos); materiais `Shirt, Shorts, Socks, Skin, Hair, Boots` (+ `Gloves, Eyes`); UV da camisa; ≤ 25 mil triângulos.
`node tools/inspect-glb.mjs assets/models/athlete.glb` confere tudo isso e explica cada problema. O mesmo inspetor roda no navegador antes de carregar o modelo.

## 4. Animações: o que fica no modelo e o que o jogo faz
**No modelo (nenhuma obrigatória):** `Idle`, `Walk`, `Run` são opcionais; o jogo não depende delas.
**No jogo (já implementado em `js/rig.js`, e reaproveitado pelos dois motores):** espera, caminhada, corrida de aproximação, apoio, recuo, **chute** (contato sincronizado com a física), acompanhamento, recuperação, reação a gol/falha, **as quatro defesas** (alta, média, baixa, central, escolhidas pela trajetória da bola, com mãos indo à bola por IK), queda, recuperação, comemoração coletiva e decepção.
**Por que no jogo e não no modelo:** o instante do contato, o ponto onde as mãos do goleiro chegam e a altura do salto dependem da bola; clipes fixos não sincronizam. `js/three/retarget.js` converte as poses do `rig.js` em rotações dos ossos do GLB (T-pose ou A-pose, qualquer proporção).
*Fase futura (não implementada):* usar clipes do artista (`Kick`, `Save_*`) com marcador de contato, caso a poses procedurais não agradem.

## 5. Uniformes sem um modelo por time/jogador
Um único GLB é instanciado (`SkeletonUtils.clone`) e cada instância recebe:
- **camisa:** textura gerada em canvas (padrão do clube, cores, gola, número nas costas e na frente, **nome**, **escudo**) aplicada ao material `Shirt`; layout `wrap` (padrão) ou `atlas` (`uniform-layout.json`);
- **calção/meias/pele/cabelo/chuteira/luvas:** cor do material (`Shorts, Socks, Skin, Hair, Boots, Gloves`);
- **cabelo:** malha `Hair_*` escolhida por atleta (se existir);
- **escudo:** `assets/crests/<key>.png` (e `CRESTS` em `teams.js`); sem o arquivo, escudo genérico com a sigla (provisório).
Pré-visualização: abra `tools/uniform-preview.html` pelo Live Server.

## 6. Arquitetura
`js/frame.js` (puro) descreve cada quadro: poses, bola, câmera. `js/three/engine.js` desenha esse quadro (estádio em `three/stadium.js` + `three/stadiumFx.js`, atletas via `three/loader.js`) e se registra em `js/renderer.js`, que `game.js` chama a cada quadro. Física, placar, mira e animações vêm da lógica pura; o motor só desenha. Módulos compartilhados: `vec.js` (vetores), `face.js` (paletas/rosto), `shirtTex.js` (camisa procedural do goleiro e de clubes sem textura), `crowd.js` (dados e sprites da torcida).

## 7. Como testar quando os arquivos chegarem
1. Copie os 4 arquivos do Three.js e `athlete.glb`. 2. `node tools/inspect-glb.mjs assets/models/athlete.glb`. 3. `node tools/check-3d-setup.mjs`. 4. `iniciar.bat` (ou Live Server → `index.html`).
*Teste de encanamento sem modelo real:* copie `assets/models/_test/minimal-humanoid.glb` para `assets/models/athlete.glb` (só valida o carregamento; a aparência será de triângulos).

## 8. O QUE EU PRECISO RECEBER (exato)
1. `three.module.js`, `GLTFLoader.js`, `BufferGeometryUtils.js`, `SkeletonUtils.js` (r160) nos caminhos da seção 2 — ou me diga a versão que você tiver.
2. `assets/models/athlete.glb` (obrigatório) e, se tiver, `goalkeeper.glb`.
3. Se o mapa de UV da camisa não for o "wrap": `uniform-layout.json` com as regiões; se os ossos tiverem nomes incomuns: `skeleton-map.json`.
4. (opcional) PNGs dos escudos em `assets/crests/` e a licença dos modelos.
Com isso eu rodo o inspetor, carrego no navegador, ajusto o retargeting (torção/escala) e valido visualmente.

## 9. Situação dos testes
*(procedimento de instalação passo a passo: `INSTALACAO_3D.md`)*
| Parte | Situação |
|---|---|
| Quadro puro (`frame.js`), 18 testes | **testado** |
| Retargeting + nomes de ossos, 28 testes (T/A-pose, escala, ossos opcionais, lados) | **testado** (Node, esqueleto sintético) |
| Inspetor/gerador de GLB, 13 testes (aprova correto; recusa -Z, lados, materiais, Draco…) | **testado** |
| Compositor de uniformes (8 equipes, atlas e wrap) | **testado** no navegador (inspeção visual) |
| Sem Three.js/modelos: tela com o motivo e "tentar de novo" | **testado** no navegador (Three.js ausente simulado) |
| Jogo completo no 3D: 20 clubes, partida até o fim, revanche, 2 jogadores, campeonato, clique do chute, placar e mira | **testado** no navegador (2026-10) |
| Preparação de atleta a partir de humanoide rigado (`prepare-athlete.mjs`, 18 testes, modelo sintético) | **testado** em Node; **não testado com um modelo real** (ex.: Quaternius) |
| Instalador do Three.js (`setup-3d.mjs`, 6 testes offline: cópia local, HTTP local, erros) | **testado** sem internet; o download real de unpkg/jsdelivr **não foi testado** |
| `tools/three-smoke.html` (diagnóstico visual) | só sintaxe; precisa de Three.js |
| `loader.js`, `stadium.js`, `stadiumFx.js`, `engine.js` | **testados** no navegador com Three.js r160 e o `athlete.glb` real |
| Aparência dos 220 titulares (cabelo, barba, bigode, costeleta, faixa) | **testado**: as peças visíveis batem com a tabela para os 220; desempenho medido (≈11 ms/quadro na partida) |
**Limitações conhecidas:** a torcida em sprites só balança (sem os braços levantados do antigo motor 2D); o cabelo comprido é rígido (preso à cabeça); `goalkeeper.glb`, `skeleton-map.json` e `uniform-layout.json` são opcionais e geram um 404 no console quando ausentes.
