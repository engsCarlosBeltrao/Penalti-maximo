// Ponto de ligação entre a lógica (game.js) e o desenho: o motor 3D (js/three/engine.js) se registra aqui ao carregar.
// Até lá (ou se falhar) drawScene fica nulo e game.js simplesmente não desenha.
export const Renderer = {
  name: 'nenhum', drawScene: null, setTeams: null,
  set(impl) { this.name = impl.name; this.drawScene = impl.drawScene; this.setTeams = impl.setTeams; }
};
