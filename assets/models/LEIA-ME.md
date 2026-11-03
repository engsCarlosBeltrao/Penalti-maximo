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
  `chute.glb` (clipe "Chute", 30 fps, 38 quadros, contato no quadro 17) é gerado por:
  `"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python-exit-code 1 -P tools/blender/chute.py -- assets/models/athlete.glb assets/models/anim/chute.glb .claude/skills`
  (IK nas pernas, pé de apoio travado, quadros-chave em Bézier, bake pelo `bake_action.py` da skill blender-animation). O script imprime medidas: distância do pé à bola no contato, deriva do pé de apoio, quadro do pico de velocidade e se algo atravessa o gramado.
  No jogo, `loader.js → loadClip/playClip` toca o clipe no cobrador com o contato no instante em que a bola sai (`tc = 0` em `frame.js`), com transição de 0,15 s na entrada e na saída. Sem o arquivo, o chute volta às poses de `rig.js`.
