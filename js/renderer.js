// Seleção do motor de renderização. O motor do jogo é o Three.js/GLB (js/three/engine.js), que assume assim que carrega.
// O procedural (scene3d.js) só fica ativo com ?engine=2d ou no jogar.html (sem servidor).
export const Renderer = {
  name: 'nenhum', drawScene: null, setTeams: null,
  set(impl) { this.name = impl.name; this.drawScene = impl.drawScene; this.setTeams = impl.setTeams; }
};
