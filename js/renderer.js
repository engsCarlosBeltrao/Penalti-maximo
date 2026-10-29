// Seleção do motor de renderização. Padrão: motor PROCEDURAL (scene3d.js), que permanece como alternativa e fallback.
// O motor Three.js/GLB (js/three/engine.js) só assume depois de carregar com sucesso (index.html?engine=three).
export const Renderer = {
  name: 'nenhum', drawScene: null, setTeams: null,
  set(impl) { this.name = impl.name; this.drawScene = impl.drawScene; this.setTeams = impl.setTeams; }
};
