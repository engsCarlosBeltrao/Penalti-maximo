// MOTOR DO JOGO: Three.js (r160) + GLB. main.js o carrega por padrão; se faltar Three.js, o modelo ou o WebGL, start() REJEITA sem efeito colateral
// e main.js mostra o motivo (com a opção de tentar de novo). Toda a animação vem de frame.js/rig.js; aqui só se desenha.
import * as THREE from 'three';
import { Renderer } from '../renderer.js';
import { Events } from '../events.js';
import { GS } from '../gameState.js';
import { flightTime, ballWorld, camTarget, characters } from '../frame.js';
import { KICK_CLIPS } from '../kickClips.js';
import { FORCE_BANDS, GOAL_REACTIONS, MISS_REACTIONS } from '../kicks.js';
import { humanJoints, goalToWorld, GOAL_W, GOAL_H, BALL0 } from '../rig.js';
import { hud } from '../hud.js';
import { AIM_LIM } from '../aim.js';
import { lerp } from '../vec.js';
import { loadTemplate, instantiate, fetchJSON, loadClip } from './loader.js';
import { loadKitPack } from './kitPack.js';
import { LAYOUTS } from './uniform.js';
import { buildStadium } from './stadium.js';
import { createStadiumFx } from './stadiumFx.js';
import { DBG } from '../debug.js';
import { colorize, clearSprites } from '../crowd.js';
const W = 960, H = 540;
export async function start({ cv, base = 'assets/models/' }) {
  // 1) arquivos e validação ANTES de mexer na página (qualquer falha aborta sem efeito colateral)
  const skeletonMap = (await fetchJSON(base + 'skeleton-map.json')) || {}, lay = await fetchJSON(base + 'uniform-layout.json'), layout = lay && lay.type === 'atlas' ? lay : LAYOUTS.wrap;
  await loadKitPack();                                                                              // camisas do pack (assets/kits); sem o pack, usa o uniforme procedural
  const tpl = await loadTemplate(base + 'athlete.glb', { skeletonMap, layout }); let tplG = tpl;
  // clipes das cobranças (tools/blender/cobranca.py; um por estilo × tipo), carregados sob demanda e pré-carregados em segundo plano;
  // chute.glb (tools/blender/chute.py) é o médio de referência: substitui comum_medio se este faltar. Sem clipe, o chute volta às poses do rig.js.
  const clips = {}, loading = {}, fail = e => { console.warn('Clipe de cobrança indisponível (usa as poses do rig.js):', e); return null; };
  const want = id => { if (id in clips || loading[id]) return clips[id] || null; const c = KICK_CLIPS[id], url = c ? base + 'anim/' + c.arquivo : base + 'anim/chute.glb';
    loading[id] = loadClip(url).then(ci => ci || (id === 'comum_medio' ? loadClip(base + 'anim/chute.glb') : null)).catch(fail).then(ci => { clips[id] = ci; delete loading[id]; return ci; }); return null; };
  clips.chute = await loadClip(base + 'anim/chute.glb').catch(fail);
  await Promise.all(['comum_medio', 'comum_chapada', 'comum_bomba'].map(id => (want(id), loading[id])));   // os comuns já prontos; os dos craques chegam em segundo plano
  Object.keys(KICK_CLIPS).forEach(want);
  const idle = { r: await loadClip(base + 'anim/repouso_r.glb').catch(fail), l: await loadClip(base + 'anim/repouso_l.glb').catch(fail) };   // repouso do cobrador (tools/blender/repouso.py)
  const reac = {};                                                                                  // entrada + 5 comemorações + 5 frustrações, destro e canhoto (tools/blender/reacoes.py)
  await Promise.all(['entrada', ...Object.keys(GOAL_REACTIONS), ...Object.keys(MISS_REACTIONS)].flatMap(n => ['r', 'l'].map(async pe => { reac[n + '_' + pe] = await loadClip(base + `anim/${n}_${pe}.glb`).catch(fail); })));
  try { tplG = await loadTemplate(base + 'goalkeeper.glb', { skeletonMap, layout }); } catch (e) { if (e.status !== 404) throw e; console.info('goalkeeper.glb ausente: o goleiro usará athlete.glb com o uniforme de goleiro.'); }
  // 2) WebGL por baixo da tela 2D (que continua desenhando o placar/HUD, transparente)
  const gl = document.createElement('canvas'); gl.id = 'gl'; Object.assign(gl.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none' }); cv.parentNode.insertBefore(gl, cv);
  cv.style.position = 'relative';   // a tela 2D (placar, mira) fica POR CIMA do WebGL e continua recebendo o clique do chute; o menu (#ui) segue acima de ambas
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true }); } catch (e) { gl.remove(); throw e; }
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; const app = cv.parentNode, resize = () => { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(app.clientWidth, app.clientHeight, false); }; window.addEventListener('resize', resize); resize();
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, W/H, .2, 220), st = buildStadium(scene), fx = createStadiumFx(scene); DBG.fx = fx; DBG.scene = scene;
  const field = [0, 1, 2, 3, 4].map(() => { const i = instantiate(tpl); i.root.visible = false; scene.add(i.root); return i; }), keeper = instantiate(tplG, { maos: 'luva' }); keeper.root.visible = false; scene.add(keeper.root);
  DBG.field = field;                                                                                // só para depuração (testes no navegador)
  // 3) estado visual (câmera suavizada, tremor e reação da torcida) — igual ao motor procedural
  let cam = { pos: [0, 3.3, 25], tgt: [0, 1, 1], fov: 27 }, shake = 0, last = 0, exS = [0, 0], sad = [0, 0];
  [['gol', e => { exS[e.equipe] = 1; sad[1 - e.equipe] = 1; shake = 1; fx.burst(e.equipe); }], ['defesa', e => { exS[1 - e.equipe] = .7; sad[e.equipe] = .6; shake = .5; }], ['trave', () => { exS = exS.map(v => Math.max(v, .4)); shake = .8; }], ['fora', e => { sad[e.equipe] = .5; }], ['partida_encerrada', e => { exS[e.vencedor] = 1; sad[1 - e.vencedor] = 1; fx.burst(e.vencedor); }]].forEach(([k, f]) => Events.on(k, f));
  const rng = () => Math.random() - .5, J = a => new THREE.Vector3(...a);
  function drawAim(c, aim, hold) {                                                  // mira no plano do gol, projetada pela câmera 3D
    const P = (x, y) => { const v = new THREE.Vector3(x, y, .05).project(camera); return [(v.x*.5 + .5)*W, (-v.y*.5 + .5)*H]; }, x = (aim.x - .5)*GOAL_W, a = P(x, 0), t = P(x, GOAL_H), q = P(x, aim.y*GOAL_H), r = Math.abs(P(x + .25, 0)[0] - a[0]);
    c.save(); c.lineCap = 'round'; c.strokeStyle = 'rgba(255,230,109,.7)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(t[0], t[1]); c.stroke(); c.fillStyle = '#ffe66d'; c.beginPath(); c.moveTo(t[0] - 7, t[1] - 16); c.lineTo(t[0] + 7, t[1] - 16); c.lineTo(t[0], t[1] - 6); c.fill();
    c.strokeStyle = hold ? '#ff2d55' : 'rgba(255,255,255,.9)'; c.lineWidth = 2.5; c.beginPath(); c.arc(q[0], q[1], r*(hold ? 1.2 : .9), 0, 7); c.stroke();
    const b0 = P(GOAL_W/2 + .9, 0), b1 = P(GOAL_W/2 + .9, GOAL_H), f = (aim.y - AIM_LIM.ymin)/(AIM_LIM.ymax - AIM_LIM.ymin), hh = b0[1] - b1[1]; c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(b0[0], b1[1], 9, hh); c.fillStyle = hold ? '#ff2d55' : '#ffe66d'; c.fillRect(b0[0], b0[1] - hh*f, 9, hh*f);
    c.fillStyle = 'rgba(255,255,255,.85)'; [FORCE_BANDS.chapada, FORCE_BANDS.medio].forEach(v => c.fillRect(b0[0] - 3, b0[1] - hh*v - 1, 15, 2)); c.restore();   // fronteiras da força: chapada | médio | bomba
  }
  function drawScene(c, game) {
    const now = performance.now()/1000, dt = Math.min(.05, now - last || .016); last = now; exS = exS.map(v => Math.max(0, v - dt*.5)); sad = sad.map(v => Math.max(0, v - dt*.4)); shake = Math.max(0, shake - dt*2.2);
    const b = game.fin ? null : game.ball, k = game.keeper, res = b?.res, d = b ? b.t - flightTime(b) : 0, bw = ballWorld(b, k), T = camTarget(game, b, bw, res, d), f = 1 - Math.exp(-3*dt);
    cam.pos = lerp(cam.pos, T.pos, f); cam.tgt = lerp(cam.tgt, T.tgt, f); cam.fov += (T.fov - cam.fov)*f; if (DBG.cam) cam = { pos: DBG.cam.pos.slice(), tgt: DBG.cam.tgt.slice(), fov: DBG.cam.fov };
    camera.fov = cam.fov; camera.updateProjectionMatrix(); camera.position.set(cam.pos[0] + (shake ? rng()*shake*.12 : 0), cam.pos[1] + (shake ? rng()*shake*.12 : 0), cam.pos[2]); camera.lookAt(J(cam.tgt));
    // personagens: o rig.js define as poses; o GLB as recebe por retargeting
    const fr = characters(game, now, b, k, res, d, bw); let n = 0; field.forEach(i => { i.root.visible = false; }); keeper.root.visible = false;
    if (fr) fr.list.forEach(ch => { const inst = ch.role === 'keeper' ? keeper : field[n++]; if (!inst) return; inst.root.visible = true; inst.apply(ch.kit, ch.look);
      const an = ch.anim, ic = an && an.idle && idle[an.pe], rc = ic && an.ready.w > 0 && want(an.ready.clip);
      if (ic) inst.playIdle(ic, an.t, an.pos, an.yaw, rc ? { ci: rc, w: an.ready.w, pos: [BALL0[0], 0, BALL0[2]], yaw: Math.PI } : null);   // repouso / carregando
      else if (an && reac[an.clip + '_' + an.pe]) inst.playClip(reac[an.clip + '_' + an.pe], an.t, an.pos, an.yaw, an.blend);
      else { const ci = an && !an.idle && (want(an.clip) || (an.clip === 'comum_medio' ? clips.chute : null)); if (ci) inst.playClip(ci, ci.contact + an.tc, [BALL0[0], 0, BALL0[2]], Math.PI); else inst.pose(humanJoints(ch.P)); } });   // chute: clipe do Blender com o contato no instante em que a bola sai (tc = 0)
    st.ball.visible = !!fr && !fr.final; st.ball.position.set(bw[0], bw[1], bw[2]); if (b) st.ball.rotation.x -= dt*14*(b.t > 0 ? 1 : 0);
    st.updateNet(res === 'gol' && d > 0 ? Math.max(0, 1 - d/.8)*Math.cos(d*22) : 0, b ? goalToWorld(b.gx, b.gy) : [0, 1, 0]); st.updateBoards(now); st.updateCrowd(now, exS, sad); fx.update(now, dt, game);
    renderer.render(scene, camera);
    // HUD 2D por cima (a tela 2D é transparente neste modo)
    const k0 = c.canvas.width/W; c.setTransform(k0, 0, 0, k0, 0, 0); c.clearRect(0, 0, W, H);
    if (game.m && !game.fin && game.hum() && !b && (GS.estado === 'MIRANDO' || GS.estado === 'AGUARDANDO_COBRANCA')) drawAim(c, game.aim, GS.estado === 'MIRANDO');
    hud(c, game, res, b);
  }
  const setTeams = (a, bb) => { colorize([a, bb]); clearSprites(); st.buildCrowd(); fx.setTeams(a, bb); };
  Renderer.set({ name: 'three', drawScene, setTeams });
  return { renderer, scene, camera };
}
