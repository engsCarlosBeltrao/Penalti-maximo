# Conserto do pescoço, ombros e camisa: relatório

Data: 29/10/2026. Pasta: `files333`. Tudo está no Git local da pasta (`git log --oneline`).

## Commits (do primeiro ao último)

| Commit | O que fez |
|---|---|
| `e34dcad` | Estado inicial + backup `assets/models/athlete.original.glb` |
| `4765fc8` | `tools/measure-athlete.mjs`: medidor somente leitura |
| `b4b5e9f` | `tools/fix-neck-shoulders.mjs`: corretor do modelo 3D |
| `440e20a` | `skeletonMap.js` reconhece `neck_01`; `retarget.js` com `SHOULDER_DROOP = 0` |
| `ffb32bd` | `athlete.glb` trocado pelo modelo corrigido |
| `e92f445` | `js/athlete.js` (desenho procedural) + `bundle.js` regenerado |

## Roteiro: comandos para refazer ou conferir

```bash
# 1. Medir o modelo (só lê). Com 2 arquivos compara antes → depois
node tools/measure-athlete.mjs
node tools/measure-athlete.mjs assets/models/athlete.original.glb assets/models/athlete.glb

# 2. Gerar o modelo corrigido a partir do original (nunca sobrescreve a entrada)
node tools/fix-neck-shoulders.mjs                      # original → assets/models/athlete.fixed.glb
FIX_JSON='{"ombro":{"graus":22}}' node tools/fix-neck-shoulders.mjs   # experimentar parâmetros (números com 0 antes do ponto: 0.008)
cp assets/models/athlete.fixed.glb assets/models/athlete.glb          # colocar no jogo

# 3. Validar
node tools/inspect-glb.mjs assets/models/athlete.glb
node tools/check-3d-setup.mjs
for t in test.mjs test_music.mjs test_rig.mjs test_frame.mjs test_retarget.mjs test_glb.mjs test_kits.mjs test_lineups.mjs; do node $t | tail -1; done
#   (test_prepare, test_setup e test_layouts GRAVAM arquivos: não foram rodados)

# 4. Regenerar o bundle do jogar.html depois de mexer em js/
bash build_bundle.sh

# 5. Ver no navegador (servidor local; abrir com Ctrl+F5 por causa do cache)
python -m http.server 8765 --bind 127.0.0.1
#   http://127.0.0.1:8765/index.html?engine=three   (modelo 3D)
#   http://127.0.0.1:8765/index.html                (procedural)
#   http://127.0.0.1:8765/jogar.html                (procedural, bundle)
#   http://127.0.0.1:8765/tools/three-smoke.html?model=../assets/models/athlete.glb   (visualizador de poses)

# Voltar atrás
cp assets/models/athlete.original.glb assets/models/athlete.glb     # só o modelo
git checkout e34dcad -- .                                            # tudo como estava no início
```

## O que foi encontrado (diagnóstico)

- O jogo tem **dois desenhos de jogador**: o procedural (`js/athlete.js`, padrão em `jogar.html` e `index.html`) e o GLB (`index.html?engine=three`). O arquivo `js/three/athlete.js` não é usado por ninguém.
- O corpo do GLB é o `SuperHero_Male` da Quaternius, em T-pose: a base do pescoço tinha 19 cm de largura e o ombro era um degrau reto (3° de inclinação). A camisa só copiava esse formato.
- O modelo bruto original não existe mais (`assets/models/raw` vazio), então o conserto teve de editar o GLB já pronto.
- O jogo **não reconhecia o osso `neck_01`**: o pescoço nunca era animado.
- `SHOULDER_DROOP = .5` fazia o ombro cair **48°** com o jogador parado.

## Deu certo

| Item | Antes | Depois |
|---|---|---|
| Meia-largura do pescoço (GLB) | 0,093 | 0,071 |
| Inclinação do ombro, camisa (GLB) | 3,4° | 18,8° |
| Folga mínima camisa → pele | 1 mm | 5,7 mm (62 pontos colados → 0) |
| Ombro com o jogador parado (animação) | 48° | ~25° |
| Penetrações de pele visíveis nas poses (soma de 12 poses) | 47 | 42 |
| Penetrações na gola | várias | nenhuma |

- Rosto, olhos, 6 cabelos, 4 barbas, texturas, materiais, esqueleto, UVs da camisa e `shirtUV` ficaram **byte a byte iguais** (o corretor confere isso sozinho). Por isso escudos, patrocinadores, nome, número e cores não mudaram.
- Nenhum triângulo invertido; o `inspect-glb` e o `check-3d-setup` aprovam; os 8 testes que só leem passam.
- O corretor é reproduzível: rodando de novo sai o mesmo arquivo, byte a byte.
- Procedural: o tronco desce até o pescoço, os ombros não são mais bolas acima do tronco, o pescoço ficou mais curto e proporcional. Visto em `index.html` e `jogar.html`.

## Deu errado (e o que foi feito)

| Problema | Causa | Solução |
|---|---|---|
| Medidor: inclinação do ombro deu 60° | pegava a lateral do pescoço | medir a partir de x=0,10/0,125 |
| Medidor: largura do pescoço na fatia errada | arredondamento na escolha da fatia | escolher a fatia que contém a altura |
| 1ª geração: o ombro quase não desceu | malha esparsa, faixas de 5 mm sem vértices | janela de ±2 cm |
| Erro de sintaxe no corretor | comentário inserido no meio da linha | movido para o fim |
| 13 triângulos invertidos na gola | empurrar só a borda interna da bainha | empurrar a vizinhança junta (raio 1,2 cm) |
| Vinco na nuca | eixo do pescoço calculado pela pele (o queixo puxava) | eixo entre os ossos Neck e Head |
| "Dente"/cunha na gola de trás | a descida do ombro começava dentro da gola | começar fora da gola (x0 = 0,12) e transição mais larga |
| Dobra sob a mandíbula e gola folgada | afinamento parava de uma vez; gola afinava menos que o pescoço | transição longa na nuca; a roupa copia o deslocamento da pele |
| Risco de pele no deltoide (defesa alta) | baixar o deltoide de um modelo em T-pose | copiar pesos (não resolveu), afundar a pele escondida no ombro (melhorou parte). **Ainda aparece** |
| Afundar a pele até a axila | superfície côncava | piorou; desfeito |
| Navegador mostrava código antigo | cache de módulos JS | forçar revalidação / Ctrl+F5 |
| Procedural, 1ª tentativa: bolas dos ombros separadas e pescoço "palito" | topo do tronco fino demais (0,14) | topo 0,17, pescoço mais grosso, gola mais alta |
| `FIX_JSON` com `.008` | JSON não aceita número sem 0 | usar `0.008` |

## O que ficou pendente

- **Risco fino no deltoide com o braço levantado** (modelo 3D). Aceito por você.
- Pescoço do GLB em 0,071, 1 mm acima do alvo 0,07 que eu mesmo defini; afinar mais criava dobra.
- Penetrações na **axila** (escondida sob o braço) subiram de 103 para 140 na soma das poses.
- Não conferido na tela: todos os clubes (só Flamengo, São Paulo, Santos e goleiro), todos os cabelos e barbas.
- O procedural foi conferido só visualmente, sem números.
- Já existia antes e não foi mexido: `assets/models/uniform-layout.json` do tipo "atlas" é carregado pelo jogo (na partida a camisa saiu certa); o modelo tem 30.636 triângulos (aviso de ≤ 25.000); não há `goalkeeper.glb`.
- Os scripts de diagnóstico das poses (`pose-check.mjs`, `pose-face.mjs`, `flips.mjs`) ficaram fora do projeto, na pasta temporária da sessão. Se quiser, dá para colocá-los em `tools/`.
