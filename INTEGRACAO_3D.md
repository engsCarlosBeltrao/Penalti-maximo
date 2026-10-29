# Integração de modelos 3D reais (Three.js + GLB) — Pênalti Máximo

**Estado:** a integração está *preparada*. O motor atual (procedural) continua sendo o padrão e o fallback. O motor Three.js só assume com `index.html?engine=three`, depois de validar Three.js e modelos; se algo faltar, o jogo avisa na tela e segue no motor atual.

## 1. Versão do Three.js
**Three.js r160 (`three@0.160.0`).** Motivos:
- `build/three.module.js` é um **arquivo único** (a divisão em `three.core.js` começa em r17x), então bastam 4 arquivos locais.
- O projeto não tem bundler (concatenação simples). O Three.js é carregado como **módulo ES via `importmap`** (já adicionado ao `index.html`), o que exige abrir por **Live Server (http)**. `jogar.html` (clique duplo/`file://`) nunca carrega o Three.js e continua no motor atual.
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

## 6. Arquitetura (motor atual preservado)
`js/frame.js` (puro) descreve cada quadro: poses, bola, câmera. `js/renderer.js` escolhe o motor. `js/scene3d.js` = procedural (padrão). `js/three/engine.js` = Three.js/GLB (opcional). Ambos desenham o **mesmo** quadro, então física, placar, mira e animação não mudam.

## 7. Como testar quando os arquivos chegarem
1. Copie os 4 arquivos do Three.js e `athlete.glb`. 2. `node tools/inspect-glb.mjs assets/models/athlete.glb`. 3. `node tools/check-3d-setup.mjs`. 4. Live Server → `index.html?engine=three` (aparece "Motor Three.js/GLB ativo").
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
| Fallback sem Three.js/modelos (`?engine=three`) | **testado** no navegador |
| Motor procedural após a refatoração (jogo, músicas, regras) | **testado** (regressão completa) |
| Preparação de atleta a partir de humanoide rigado (`prepare-athlete.mjs`, 18 testes, modelo sintético) | **testado** em Node; **não testado com um modelo real** (ex.: Quaternius) |
| Instalador do Three.js (`setup-3d.mjs`, 6 testes offline: cópia local, HTTP local, erros) | **testado** sem internet; o download real de unpkg/jsdelivr **não foi testado** |
| `tools/three-smoke.html` (diagnóstico visual) | só sintaxe; precisa de Three.js |
| `loader.js`, `stadium.js`, `engine.js` (usam Three.js) | **NÃO testados**: só sintaxe; escritos para a API do r160 |
| Aparência com atletas GLB, sombras, desempenho WebGL, estádio em Three.js | **não testados** |
**Riscos conhecidos:** nomes/versões de API do Three.js podem exigir ajuste; torção de braços/pernas pode precisar de calibração conforme o rig do modelo; no modo Three.js a torcida usa sprites estáticos (sem braços levantados, bandeiras, faixas e fumaça); porte/altura individuais dos atletas ainda não são aplicados ao GLB.
