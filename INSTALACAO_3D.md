# Instalação do motor Three.js + atleta GLB — passo a passo (no SEU computador)

> **Onde ficam os scripts:** eles funcionam em qualquer pasta — na raiz do projeto ou numa pasta `tools/`. Nos comandos abaixo o prefixo `tools/` foi omitido; use o caminho onde SEUS arquivos estão (ex.: `node .\check-3d-setup.mjs` no Windows, ou `node tools/check-3d-setup.mjs`). Cada script acha a raiz do projeto sozinho e diz exatamente o que falta se algum arquivo não existir.

Pré-requisitos: **Node 18+**. Para jogar: `iniciar.bat` (ou a extensão **Live Server** do VS Code). O jogo é só 3D.

## 1) Instalar o Three.js r160 (4 arquivos em `vendor/three/`)
Na pasta do projeto:
```
node setup-3d.mjs
```
Baixa de `unpkg.com` (e, se falhar, de `cdn.jsdelivr.net`), confere o conteúdo e a revisão (r160).
**Sem internet no script / bloqueio de rede?** Alternativa offline:
```
npm pack three@0.160.0
tar -xf three-0.160.0.tgz
node setup-3d.mjs --from package
```
(No Windows 10/11 o `tar` já existe. Depois pode apagar `package/` e o `.tgz`.)

### Se o script falhar (ou se o arquivo aparecer "estranho" ao copiar)
- Use SEMPRE o arquivo do projeto, não um trecho copiado de chat/site: visualizadores podem transformar endereços em links e alterar barras e caracteres.
- Confira o arquivo: `node --check setup-3d.mjs` e `node setup-3d.mjs --self-test` (ambos devem terminar sem erro).
- O instalador explica o motivo da falha (sem internet/DNS, proxy devolvendo página HTML, HTTP 404, arquivo truncado, conteúdo inesperado, certificado).
- Caminho que não usa o script nem digita endereços: `npm pack three@0.160.0`, depois `tar -xf three-0.160.0.tgz`, depois `node setup-3d.mjs --from package`.

## 2) Obter um modelo de atleta
Opção recomendada para começar (CC0, sem uniforme de futebol): **Quaternius – Universal Base Characters**
`https://quaternius.com/packs/universalbasecharacters.html` → baixe o pacote **glTF** → extraia → copie UM personagem (por exemplo um "Regular" masculino) para `assets/models/raw/` (aceita `.glb` ou `.gltf` com seus `.bin`/imagens ao lado).
Outras fontes e licenças em `assets/models/raw/LEIA-ME.md`.

## 3) Transformar o modelo em atleta (materiais do uniforme + UV da camisa)
```
node prepare-athlete.mjs assets/models/raw/NOME-DO-ARQUIVO.glb assets/models/athlete.glb
```
A ferramenta separa a malha em `Shirt, Shorts, Socks, Skin, Hair, Boots, Gloves` pelos pesos dos ossos, gera a UV cilíndrica da camisa e roda o inspetor. Se disser que não reconhece os ossos, ela lista os nomes: crie `assets/models/skeleton-map.json` (`{"Hips":"nome_no_seu_modelo", …}`) e rode de novo com `--map assets/models/skeleton-map.json`.
*(Detalhe: o "cabelo" gerado é a calota superior da cabeça, e as "luvas" são as mãos; servem para colorir. Cabelos individuais exigem malhas `Hair_*` feitas por um artista.)*

## 4) Conferir tudo
```
node check-3d-setup.mjs
```

## 5) Diagnóstico visual (etapas 1 a 5 do plano) — `three-smoke.html`
No VS Code: botão direito em `three-smoke.html` → **Open with Live Server**. A página mostra, em ordem, o que passou e o que falhou:
1. Three.js carrega · 2. WebGL · 3. inspetor do modelo · 4. GLB carregado pelo GLTFLoader · 5. malha com esqueleto (`SkinnedMesh`).
Depois: ligue **malha (wireframe)** e **esqueleto**, gire o modelo, troque o **uniforme** (20 clubes) e as **poses** (chute em 3 instantes, 4 defesas do goleiro, central alta, comemoração). Clique em **Baixar captura**.

## 6) Jogar com o motor novo
`iniciar.bat` (ou Live Server → `index.html`). O jogo abre direto no 3D; se algo faltar, aparece na tela o motivo e um botão "tentar de novo".

## O que me devolver (para eu continuar a partir daí)
Se algo falhar, me envie **o texto do painel de etapas** (copie/cole) e a saída dos comandos 1, 3 e 4. Se tudo passar, me envie:
1. **A captura** da página de diagnóstico (com wireframe e esqueleto ligados) e uma do jogo (`index.html`).
2. Os 4 arquivos `vendor/three/**` (MIT) — preciso deles para rodar o motor aqui.
3. `assets/models/athlete.glb` **somente se a licença do modelo permitir redistribuição** (CC0 permite). Sem ele eu não consigo testar o movimento aqui; nesse caso, me mande as capturas e os logs.
Com isso eu valido: (4) cobrança completa, (5) as quatro defesas, (3) escudos e uniformes no jogo, e só depois (6) a torcida em 3D.
