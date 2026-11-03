# assets/models — modelos 3D (GLB) do Pênalti Máximo

## Arquivos
| Arquivo | Obrigatório | Função |
|---|---|---|
| `athlete.glb` | **sim** | jogador de linha; também usado pelo goleiro se `goalkeeper.glb` não existir |
| `goalkeeper.glb` | não | goleiro (se quiser luvas/mangas longas próprias) |
| `uniform-layout.json` | só se a UV da camisa NÃO for o layout "wrap" | regiões do atlas da camisa (exemplo incluso) |
| `skeleton-map.json` | só se os nomes dos ossos forem fora do comum | `{ "Hips": "NomeNoSeuModelo", … }` |
| `_test/minimal-humanoid.glb` | — | modelo de teste (um triângulo por peça) gerado por `node tools/make-test-glb.mjs` |

## Contrato do modelo (conferido por `node tools/inspect-glb.mjs arquivo.glb`)
- **Formato:** `.glb` (binário), glTF 2.0, **sem compressão** (nada de Draco/Meshopt/Basis).
- **Unidades:** metros; altura 1,6–2,0 m; quadril a ~0,9–1,0 m; pés no chão em y = 0.
- **Orientação:** olha para **+Z**, +Y para cima; o lado **esquerdo** do personagem fica em **+X** (osso `Left*` com x positivo).
- **Pose de repouso:** T-pose (ideal) ou A-pose (~45°), mesmo esqueleto para todas as malhas.
- **Esqueleto (22 ossos; nomes Mixamo, Unity, Blender `.L/.R` e variações são reconhecidos):**
  `Hips, Spine, Spine1, Spine2, Neck, Head, LeftShoulder, LeftArm, LeftForeArm, LeftHand, RightShoulder, RightArm, RightForeArm, RightHand, LeftUpLeg, LeftLeg, LeftFoot, LeftToeBase, RightUpLeg, RightLeg, RightFoot, RightToeBase`
  Opcionais: `Spine1, Spine2, *Shoulder, *ToeBase, Neck`. Ossos extras (dedos, rosto, twist) são aceitos e acompanham os pais.
- **Materiais (um por peça, nomes contendo):** `Shirt` (camisa), `Shorts`, `Socks`, `Skin`, `Hair`, `Boots`; opcionais `Gloves`, `Eyes`.
  As texturas-base desses materiais devem ser **neutras (brancas/cinza)** — o jogo aplica a cor por multiplicação. A camisa pode ter textura qualquer: o jogo a substitui.
- **UV da camisa (TEXCOORD_0), formato "wrap" (padrão):** textura 512×192; `u` dá a volta no tronco (frente centrada em u=0,25; costas em u=0,75; costura na lateral), `v=0` no topo. Para outro mapa de UV use `uniform-layout.json` (atlas).
- **Cabelo variado (opcional):** malhas separadas `Hair_<penteado>` (o jogo mostra uma por atleta). Com um só `Hair`, muda apenas a cor.
- **Biblioteca de cabelo do `athlete.glb`:** 23 penteados `Hair_*`, 7 barbas `Beard_*`, 3 bigodes `Must_*`, 2 costeletas `Side_*` e a faixa `Acc_band`, geradas por `node tools/add-hair.mjs <base.glb> assets/models/athlete.glb --troca` (geometria em `tools/hair-geometry.mjs`).
  Usam os materiais `HairCap`, `Beard` e `Band` e o atributo `_HAIR` (cobertura, tom, u, v), lidos pelo shader de `js/three/hairMaterial.js` (degradê que mistura com a pele, textura de fios, duas cores, mechas, grisalho).
  A aparência de cada titular (penteado, cores, barba, bigode, costeleta, tom de pele) está em `js/lineups/appearance.js`. A textura de pele é neutralizada ao carregar (`loader.js → neutralizeSkin`) para o tom de cada jogador aparecer certo.
- **Peso:** ≤ 25 000 triângulos; texturas ≤ 2048 px; todas as malhas com pesos de osso (JOINTS_0/WEIGHTS_0).
- **Animações embutidas:** nenhuma é obrigatória. Opcional: `Idle`, `Walk`, `Run` (laços). Defesas e comemorações são feitas pelo jogo (`rig.js`); o chute vem de um clipe do Blender (abaixo).
- **Animações feitas no Blender (`assets/models/anim/`):** arquivos **só com esqueleto + clipe**, aplicados ao `athlete.glb` pelos nomes dos ossos — o modelo (malhas, materiais, cabelos, `_HAIR`, extras `shirtUV`/`legUV`) **não é reexportado** (a ida e volta pelo Blender perde esses extras e transforma `_HAIR` em cor de vértice).
  `chute.glb` (clipe "Chute", 60 fps, 139 quadros = 2,3 s, contato no quadro 78) é a cobrança inteira: parado atrás da bola → corrida de aproximação a 35° com passadas alternadas (a última mais longa) → plantio do pé de apoio ao lado e atrás da bola → recuo da perna (joelho flexiona, quadril estende) com pelve, tronco e braços no arco de tensão → chicote coxa/canela com o tornozelo travado até o peito do pé tocar a bola → acompanhamento com pulo → passada de recuperação e base fechada. Base biomecânica e parâmetros no cabeçalho do script. Gerado por:
  `"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python-exit-code 1 -P tools/blender/chute.py -- assets/models/athlete.glb assets/models/anim/chute.glb .claude/skills`
  (IK nas pernas, pés de apoio travados com os dedos presos enquanto o calcanhar sobe, curvas monótonas chaveadas em todo quadro, bake pelo `bake_action.py` da skill blender-animation). O **contato é resolvido pela geometria visível**: o script guarda os vértices da chuteira direita (materiais `Boots`/`Sole`) e recua o tornozelo na direção do golpe até a superfície da chuteira encostar na superfície da bola (folga -1 mm) no quadro do contato; o ponto de toque vai no GLB (`chute_toque`) e `playClip` desloca o clipe para que esse ponto continue na bola com a altura/largura de cada atleta. O script imprime medidas: deriva horizontal de cada apoio, erro do IK, distância chuteira–bola pela geometria (no contato, um quadro antes e o menor valor antes do contato), equilíbrio no fim (pelve parada e sobre a base dos pés), quadro do pico de velocidade da ponta do pé, flexão do joelho, ponto mais baixo dos pés e aceleração máxima por osso.
  No jogo, `loader.js → loadClip/playClip` toca o clipe no cobrador de `KICK_T0 = -1,3` a `CLIP_END = 1` s (`rig.js`), com o contato no instante em que a bola sai (`tc = 0` em `frame.js`) e transição de 0,15 s na entrada e na saída; a posição de espera (`P0`) e a de reação (`P3`) coincidem com o começo e o fim do clipe. Sem o arquivo, o chute volta às poses de `rig.js`.
