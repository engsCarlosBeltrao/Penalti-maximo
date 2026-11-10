// MOTOR DO JOGO: Three.js (r160) + GLB. main.js o carrega por padrão; se faltar Three.js, o modelo ou o WebGL, start() REJEITA sem efeito colateral
// e main.js mostra o motivo (com a opção de tentar de novo). Toda a animação vem de frame.js/rig.js; aqui só se desenha.
import * as THREE from 'three';
import { Renderer } from '../renderer.js';
import { Events } from '../events.js';
import { GS } from '../gameState.js';
import { flightTime, ballWorld, camTarget, characters } from '../frame.js';
import { KICK_CLIPS } from '../kickClips.js';
import { GOAL_REACTIONS, MISS_REACTIONS, SAVE_REACTIONS, VICTORY_REACTIONS, FEST_CLIPS } from '../kicks.js';
import { humanJoints, goalToWorld, GOAL_W, GOAL_H, BALL0, BALL_R } from '../rig.js';
import { hud } from '../hud.js';
import { criaSetaMira } from './setaMira.js';
import { lerp } from '../vec.js';
import { loadTemplate, instantiate, fetchJSON, loadClip } from './loader.js';
import { loadKitPack } from './kitPack.js';
import { LAYOUTS } from './uniform.js';
import { buildStadium } from './stadium.js';
import { createStadiumFx } from './stadiumFx.js';
import { DBG } from '../debug.js';
import { KEEPER_CLIPS } from '../keeperClips.js';
import { createKeeperDebug } from './keeperDebug.js';
// O exportador glTF do Blender grava o 1º quadro (frame 1) em t = 1/30 s. As trilhas dos colisores (js/keeperClips.js) começam em t = 0: sem tirar esse
// quadro, o goleiro na tela fica 1 quadro ATRÁS da física (até ~20 cm nas mãos no meio do mergulho). Encosta o clipe em t = 0.
function zeraInicio(ci) { const c = ci && ci.clip; if (!c) return; const t0 = Math.min(...c.tracks.map(t => t.times[0])); if (t0 > 1e-6) { c.tracks.forEach(t => { t.times = Float32Array.from(t.times, v => Math.max(0, v - t0)); }); c.resetDuration(); } }   // cópia: os trilhos compartilham o array de tempos
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
  await Promise.all(['entrada', ...Object.keys(GOAL_REACTIONS), ...Object.keys(MISS_REACTIONS), ...Object.keys(SAVE_REACTIONS), ...Object.keys(VICTORY_REACTIONS), ...Object.keys(FEST_CLIPS)].flatMap(n => ['r', 'l'].map(async pe => { reac[n + '_' + pe] = await loadClip(base + `anim/${n}_${pe}.glb`).catch(fail); })));
  const gk = {};                                                                                    // goleiro: espera + 9 defesas (tools/blender/goleiro.py)
  await Promise.all(Object.keys(KEEPER_CLIPS).map(async n => { gk[n] = await loadClip(base + 'anim/' + KEEPER_CLIPS[n].arquivo).catch(fail); zeraInicio(gk[n]); if (gk[n] && n === 'gk_espera') { gk[n].loop = true; gk[n].clip.userData = { loop: true }; } }));
  try { tplG = await loadTemplate(base + 'goalkeeper.glb', { skeletonMap, layout }); } catch (e) { if (e.status !== 404) throw e; console.info('goalkeeper.glb ausente: o goleiro usará athlete.glb com o uniforme de goleiro.'); }
  // 2) WebGL por baixo da tela 2D (que continua desenhando o placar/HUD, transparente)
  const gl = document.createElement('canvas'); gl.id = 'gl'; Object.assign(gl.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none' }); cv.parentNode.insertBefore(gl, cv);
  cv.style.position = 'relative';   // a tela 2D (placar, mira) fica POR CIMA do WebGL e continua recebendo o clique do chute; o menu (#ui) segue acima de ambas
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true }); } catch (e) { gl.remove(); throw e; }
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; const app = cv.parentNode, resize = () => { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(app.clientWidth, app.clientHeight, false); }; window.addEventListener('resize', resize); resize();
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, W/H, .2, 220), st = buildStadium(scene), fx = createStadiumFx(scene); DBG.fx = fx; DBG.scene = scene; DBG.st = st;
  const field = [...Array(11).keys()].map(() => { const i = instantiate(tpl); i.root.visible = false; scene.add(i.root); return i; }), keeper = instantiate(tplG, { maos: 'luva' }), keeper2 = instantiate(tplG, { maos: 'luva' }); keeper2.root.visible = false; scene.add(keeper2.root); keeper.root.visible = false; scene.add(keeper.root);
  DBG.field = field; DBG.keeper = keeper;                                                           // só para depuração (testes no navegador)
  const gkDbg = createKeeperDebug(scene); DBG.gkDbg = gkDbg;
  const seta = criaSetaMira(scene); DBG.seta = seta;                                               // seta da mira no gramado (só com a cobrança liberada)
  // 3) estado visual (câmera suavizada, tremor e reação da torcida) — igual ao motor procedural
  let relogio = 0;                                                                                  // relógio das animações dos jogadores: PARA durante a pausa
  let cam = { pos: [0, 3.3, 25], tgt: [0, 1, 1], fov: 27 }, shake = 0, last = 0, exS = [0, 0], sad = [0, 0];
  [['gol', e => { exS[e.equipe] = 1; sad[1 - e.equipe] = 1; shake = 1; fx.burst(e.equipe); }], ['defesa', e => { exS[1 - e.equipe] = .7; sad[e.equipe] = .6; shake = .5; }], ['trave', () => { exS = exS.map(v => Math.max(v, .4)); shake = .8; }], ['fora', e => { sad[e.equipe] = .5; }], ['partida_encerrada', e => { exS[e.vencedor] = 1; sad[1 - e.vencedor] = 1; fx.burst(e.vencedor); }]].forEach(([k, f]) => Events.on(k, f));
  const rng = () => Math.random() - .5, J = a => new THREE.Vector3(...a);
  function drawScene(c, game) {
    const now = performance.now()/1000, dt = Math.min(.05, now - last || .016); last = now; exS = exS.map(v => Math.max(0, v - dt*.5)); sad = sad.map(v => Math.max(0, v - dt*.4)); shake = Math.max(0, shake - dt*2.2);
    if (!game.paused) relogio += dt;
    if (game.vitrine && !game.m) game.vitrine.t = (game.vitrine.t || 0) + dt;   // relógio da vitrine do menu (balanço da câmera)
    const b = game.fin ? null : game.ball, k = game.keeper, res = b?.res, d = b ? b.t - flightTime(b) : 0, bw = ballWorld(b, k), T = camTarget(game, b, bw, res, d), f = 1 - Math.exp(-3*dt);
    if (armaTroca(game, now)) { cam = { pos: T.pos.slice(), tgt: T.tgt.slice(), fov: T.fov }; [keeper, keeper2, ...field].forEach(i => i.semTransicao?.()); } else { cam.pos = lerp(cam.pos, T.pos, f); cam.tgt = lerp(cam.tgt, T.tgt, f); cam.fov += (T.fov - cam.fov)*f; } if (DBG.cam) cam = { pos: DBG.cam.pos.slice(), tgt: DBG.cam.tgt.slice(), fov: DBG.cam.fov };   // na troca de cobrador a câmera salta (escondida pelo clarão)
    camera.fov = cam.fov; camera.updateProjectionMatrix(); camera.position.set(cam.pos[0] + (shake ? rng()*shake*.12 : 0), cam.pos[1] + (shake ? rng()*shake*.12 : 0), cam.pos[2]); camera.lookAt(J(cam.tgt));
    // personagens: o rig.js define as poses; o GLB as recebe por retargeting
    const fr = characters(game, relogio, b, k, res, d, bw); let n = 0; field.forEach(i => { i.root.visible = false; }); keeper.root.visible = false; keeper2.root.visible = false;
    if (fr) fr.list.forEach(ch => { const inst = ch.role === 'keeper' ? keeper : ch.role === 'keeper2' ? keeper2 : field[n++]; if (!inst) return; inst.root.visible = true; inst.apply(ch.kit, ch.look);   // keeper2: o goleiro do time derrotado na festa do título
      const an = ch.anim, ic = an && an.idle && idle[an.pe], rc = ic && an.ready.w > 0 && want(an.ready.clip);
      if (an && an.gk && gk[an.clip]) { const r = an.ready && an.ready.w > 0 && gk[an.ready.clip];   // goleiro: espera (+ preparação para o lado escolhido) ou mergulho
        if (an.idle) inst.playIdle(gk[an.clip], an.t, an.pos, an.yaw, r ? { ci: r, t: an.ready.t, w: an.ready.w, pos: an.pos, yaw: an.yaw } : null); else { inst.playClip(gk[an.clip], an.t, an.pos, an.yaw, an.blend); inst.ajustaBraco(an.ajuste); } }
      else if (ic) inst.playIdle(ic, an.t, an.pos, an.yaw, rc ? { ci: rc, w: an.ready.w, pos: [BALL0[0], 0, BALL0[2]], yaw: Math.PI } : null);   // repouso / carregando
      else if (an && reac[an.clip + '_' + an.pe]) inst.playClip(reac[an.clip + '_' + an.pe], an.t, an.pos, an.yaw, an.blend);
      else { const ci = an && !an.idle && (want(an.clip) || (an.clip === 'comum_medio' ? clips.chute : null)); if (ci) inst.playClip(ci, ci.contact + an.tc, [BALL0[0], 0, BALL0[2]], Math.PI); else inst.pose(humanJoints(ch.P)); } });   // chute: clipe do Blender com o contato no instante em que a bola sai (tc = 0)
    st.ball.visible = !!fr && !fr.final; st.ball.position.set(bw[0], bw[1], bw[2]);
    st.contato([...field, keeper, keeper2].filter(i => i.root.visible).map(i => i.root), st.ball.position, st.ball.visible, BALL_R); if (b && !game.paused) st.ball.rotation.x -= dt*14*(b.t > 0 ? 1 : 0);
    st.rede(dt, st.ball.position, st.ball.visible, res === 'gol', game.paused); st.updateBoards(now); st.updateCrowd(now, dt); fx.update(now, dt, game); if (game.fin) { const tb = game.finalCampeonato ? 1.1 : 3.2; if (game.fin.t - (game.fin.ultFumaca ?? -9) >= tb) { game.fin.ultFumaca = game.fin.t; fx.burst(GS.vencedor); } } seta.update(game, dt);   // festa: fumaça da torcida campeã (mais na final do campeonato)
    gkDbg.update(game, b, relogio, camera);
    renderer.render(scene, camera);
    // HUD 2D por cima (a tela 2D é transparente neste modo)
    const k0 = c.canvas.width/W; c.setTransform(k0, 0, 0, k0, 0, 0); c.clearRect(0, 0, W, H);
    if (game.m || !game.vitrine) hud(c, game, res, b); gkDbg.hud(c, game, b, camera, W, H);
    cortina(c, game, now);   // transição rápida na troca de cobrador
    if (DBG.rede) { const i = st.rede.info; c.save(); c.font = '600 12px monospace'; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(W - 250, 96, 240, 74); c.fillStyle = '#ffe66d'; [`REDE (tecla N): ${i.estado}`, `nós ${i.nos} · fios ${i.fios}`, `nós em contato: ${i.regiao}`, `energia: ${i.energia.toFixed(3)}`, `impacto: ${i.impacto ? i.impacto.toArray().map(v => v.toFixed(2)).join(', ') : '—'}`].forEach((t, k) => c.fillText(t, W - 242, 112 + k*14)); c.restore(); }
  }
  // TROCA DE COBRADOR: um clarão BRANCO rápido (~0,5 s). Começa 0,12 s ANTES da troca (o relógio do próprio jogo: game.wait), chega a 92% de branco
  // no instante em que a cena muda, segura 0,08 s e se dissipa em 0,3 s. No pico o goleiro VOLTA ao gol (a pose do mergulho não é mais misturada aos
  // poucos com a de espera — ele aparece direto no centro), o cobrador troca e a câmera salta para a nova cobrança: quando clareia, está tudo no lugar. Só um véu no HUD 2D; não mexe na lógica do jogo.
  const ANTES = .12, PICO = .08, DEPOIS = .3, MAX = .92; let troca = null;
  function cortina(c, game, now) {
    if (!troca) return; if (now > troca.fim || !game.m && !game.fin) { troca = null; return; }
    const d = now - troca.meio, sobe = d < 0, k = sobe ? 1 + d/ANTES : d < PICO ? 1 : 1 - (d - PICO)/DEPOIS, e = Math.max(0, Math.min(1, k));
    // entra suave e SAI se dissipando (curva que cai rápido e termina devagar)
    c.save(); c.globalAlpha = MAX*(sobe ? e*e*(3 - 2*e) : e*e); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.restore();
  }
  // chamada no começo do quadro: arma o clarão e, no pico, faz a câmera pular para o alvo (devolve true quando a câmera deve saltar)
  function armaTroca(game, now) {
    if (game.m && game.after && game.wait > 0 && game.wait <= ANTES && !game.paused && (!troca || now > troca.fim)) troca = { meio: now + game.wait, fim: now + game.wait + PICO + DEPOIS, saltou: false };
    if (troca && !troca.saltou && now >= troca.meio && !game.after) { troca.saltou = true; return true; }
    return false;
  }
  const setTeams = (a, bb) => { st.buildCrowd([a, bb]); fx.setTeams(a, bb); };
  Renderer.set({ name: 'three', drawScene, setTeams });
  return { renderer, scene, camera };
}
