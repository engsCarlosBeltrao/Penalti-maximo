# vendor/three — dependência local do Three.js (r160)

Nada aqui é baixado automaticamente. Coloque EXATAMENTE estes 4 arquivos:

| Destino (neste projeto)                                  | Origem no pacote `three@0.160.0`                   |
|----------------------------------------------------------|----------------------------------------------------|
| `vendor/three/three.module.js`                           | `build/three.module.js`                            |
| `vendor/three/addons/loaders/GLTFLoader.js`              | `examples/jsm/loaders/GLTFLoader.js`               |
| `vendor/three/addons/utils/BufferGeometryUtils.js`       | `examples/jsm/utils/BufferGeometryUtils.js`        |
| `vendor/three/addons/utils/SkeletonUtils.js`             | `examples/jsm/utils/SkeletonUtils.js`              |

## Como obter (Windows, PowerShell, dentro da pasta do projeto)
```
npm pack three@0.160.0
tar -xf three-0.160.0.tgz
copy package\build\three.module.js vendor\three\three.module.js
copy package\examples\jsm\loaders\GLTFLoader.js vendor\three\addons\loaders\GLTFLoader.js
copy package\examples\jsm\utils\BufferGeometryUtils.js vendor\three\addons\utils\BufferGeometryUtils.js
copy package\examples\jsm\utils\SkeletonUtils.js vendor\three\addons\utils\SkeletonUtils.js
rmdir /s /q package & del three-0.160.0.tgz
node tools/check-3d-setup.mjs
```
(Alternativa sem npm: baixar os 4 arquivos de `https://unpkg.com/three@0.160.0/<origem>`.)

O `index.html` já tem o `importmap` que mapeia `three` → `./vendor/three/three.module.js` e `three/addons/` → `./vendor/three/addons/`.
Se usar outra versão: r150–r169 tendem a funcionar com os mesmos 4 arquivos; r170+ exige também `three.core.js`.
