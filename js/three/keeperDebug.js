// DEPURAÇÃO DO GOLEIRO (tecla G ou ?debug=goleiro na URL): mostra os colisores presos aos ossos (os mesmos que a física usa, no instante do clipe
// que está na tela), o ponto em que o goleiro LEU que a bola cruzaria o plano do gol, o ponto real, a parte que tocou e um painel com a decisão, os tempos,
// o contato, as velocidades e o motivo de a defesa ter sido possível ou não. Desligado, nada aparece e nada muda no jogo.
import * as THREE from 'three';
import { DBG } from '../debug.js';
import { colisoresAgora, cruzamento, ROTULOS, KEEPER_CFG, ballFlight, REGIAO, classe, velocidadeGoleiro, defesaNome } from '../keeper.js';
import { probabilidades } from '../goleiroMemoria.js';
import { keeperScale, flightTime } from '../frame.js';
// cor por REGIÃO: mãos em verde (prioridade), braços em amarelo, tronco em azul, pernas e pés em laranja
const COR = { palma: 0x39ff14, maos: 0x00ff9c, dedos: 0xb2ff59, punho: 0x76ff03, antebraco: 0xc6ff00, cotovelo: 0xffea00, braco: 0xffe600, ombro: 0xffc400, peito: 0x00e5ff, abdomen: 0x40c4ff, lateral: 0x80d8ff,
  cabeca: 0x00b0ff, coxa: 0xff9100, joelho: 0xffab40, canela: 0xff6d00, pe: 0xff3d00 }, TOQUE = 0xff1744;
export function createKeeperDebug(scene) {
  try { if (typeof location !== 'undefined' && /(^|[?&])debug=goleiro\b/.test(location.search)) DBG.goleiro = true; } catch { /* sem URL */ }
  if (typeof window !== 'undefined') window.addEventListener('keydown', e => { if (e.key === 'g' || e.key === 'G') DBG.goleiro = !DBG.goleiro; });
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), sph = new THREE.SphereGeometry(1, 12, 8), Y = new THREE.Vector3(0, 1, 0), parts = new Map();
  const mat = c => new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: .55, depthTest: false });
  const parte = n => { let p = parts.get(n); if (p) return p; const m = mat(0xffffff); p = { m, c: new THREE.Mesh(cyl, m), a: new THREE.Mesh(sph, m), b: new THREE.Mesh(sph, m) }; [p.c, p.a, p.b].forEach(o => { o.renderOrder = 999; g.add(o); }); parts.set(n, p); return p; };
  const ring = (c, r) => { const o = new THREE.Mesh(new THREE.RingGeometry(r*.75, r, 28), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: .9 })); o.renderOrder = 999; g.add(o); return o; };
  const linha = (c) => { const g_ = new THREE.BufferGeometry(); g_.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3*40), 3)); const l = new THREE.Line(g_, new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: .9 })); l.renderOrder = 999; l.frustumCulled = false; g.add(l); return l; };
  const caminhoLido = linha(0xff00ff), caminhoReal = linha(0xffffff), inter = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true, depthTest: false })); inter.renderOrder = 999; g.add(inter);
  const poeCaminho = (l, b, tf) => { const a = l.geometry.attributes.position; for (let i = 0; i < 40; i++) { const p = ballFlight(b, tf*i/39); a.setXYZ(i, p[0], p[1], p[2]); } a.needsUpdate = true; };
  const sensor = ring(0x00ffff, .17), lido = ring(0xff00ff, .2), real = ring(0xffffff, .14), toque = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({ color: TOQUE, depthTest: false })); toque.renderOrder = 999; g.add(toque);
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  function update(game, b, now) {
    g.visible = !!DBG.goleiro && !!game.m && !game.fin; if (!g.visible) return; const k = game.keeper; if (!k || !k.log) { g.visible = false; return; }
    const cols = colisoresAgora(k, b, now, keeperScale(game)), hit = k.contato && k.contato.parte; ultimosCols = cols; ultimo.b = b;
    for (const p of parts.values()) { p.a.visible = p.b.visible = p.c.visible = false; }
    for (const c of cols) { const p = parte(c.nome); p.a.visible = true; p.m.color.setHex(c.nome === hit ? TOQUE : COR[c.regiao] ?? 0xffffff); va.set(...c.a); p.a.position.copy(va); p.a.scale.setScalar(c.r);
      if (c.b) { vb.set(...c.b); p.b.visible = p.c.visible = true; p.b.position.copy(vb); p.b.scale.setScalar(c.r); const d = vb.clone().sub(va), L = d.length(); p.c.position.copy(va).addScaledVector(d, .5); p.c.scale.set(c.r, L, c.r); p.c.quaternion.setFromUnitVectors(Y, d.normalize()); }
      else { p.b.visible = p.c.visible = false; } }
    lido.visible = !!k.plano; if (k.plano) lido.position.set(k.plano.lido.x, k.plano.lido.y, .02);
    caminhoLido.visible = !!k.plano?.leitura; if (k.plano?.leitura) poeCaminho(caminhoLido, k.plano.leitura, k.plano.leitura.tf || .7);       // trajetória que o goleiro leu
    caminhoReal.visible = !!b && b.t > 0; if (b && b.t > 0) poeCaminho(caminhoReal, b, Math.min(b.t, b.tf || .7));                           // trajetória real até agora
    inter.visible = !!k.plano?.intercepta; if (k.plano?.intercepta) inter.position.set(...k.plano.intercepta.p);                         // ponto previsto de interceptação
    real.visible = !!b; if (b) { const [x, y] = cruzamento(b); real.position.set(x, y, .03); }
    sensor.visible = !!k.sensor && !!b && b.t > 0; if (sensor.visible) sensor.position.set(k.sensor.ponto[0], k.sensor.ponto[1], .025);   // ponto que o SENSOR prevê agora (ciano)
    toque.visible = !!k.contato; if (k.contato) toque.position.set(...k.contato.ponto);
  }
  let ultimosCols = []; const cols0 = () => { const b = ultimo.b; if (!b || !ultimosCols.length) return null; const bp = ballFlight(b, b.t); let best = null;
    for (const c of ultimosCols) { if (c.grupo !== 'mao') continue; const ab = c.b ? [c.b[0] - c.a[0], c.b[1] - c.a[1], c.b[2] - c.a[2]] : [0, 0, 0], l2 = ab[0]**2 + ab[1]**2 + ab[2]**2 || 1, u = Math.max(0, Math.min(1, ((bp[0] - c.a[0])*ab[0] + (bp[1] - c.a[1])*ab[1] + (bp[2] - c.a[2])*ab[2])/l2));
      const d = Math.hypot(bp[0] - c.a[0] - ab[0]*u, bp[1] - c.a[1] - ab[1]*u, bp[2] - c.a[2] - ab[2]*u) - c.r - .11; if (!best || d < best.d) best = { d }; } return best; };
  const ultimo = { b: null };
  function hud(c, game, b) {
    if (!DBG.goleiro || !game.m || game.fin) return; const k = game.keeper; if (!k || !k.log) return;
    const p = k.plano, ct = k.contato, f = n => (n == null ? '—' : n.toFixed(2)), tf = b ? flightTime(b) : null, L = [];
    L.push('GOLEIRO · depuração (G liga/desliga)');
    L.push(`lado: ${k.lado || 'nenhum ainda'}${k.origem ? ` (${k.origem})` : ''} · ${k.travado ? `travado a ${f(-k.travadoEm)} s do chute` : `limite: ${KEEPER_CFG.decisaoAntes} s antes do chute`}${k.ignoradas.length ? ` · ${k.ignoradas.length} tentativa(s) depois do limite ignorada(s)` : ''}`);
    L.push(`tempo até o chute: ${b ? f(Math.max(0, -b.t)) : '—'} s · até a linha do gol: ${b ? f(Math.max(0, tf - b.t)) : '—'} s${ct ? ` · contato em t=${f(ct.t)} s` : ''}`);
    if (b) { const [x, y] = cruzamento(b); L.push(`cruzamento real: x=${f(x)} y=${f(y)} m${p ? ` (${p.real})` : ''}${p ? ` · leitura do goleiro: ${p.lido.cat} (x=${f(p.lido.x)} y=${f(p.lido.y)})` : ''}`); }
    { const pc = o => `E ${Math.round(o.esq*100)}% · C ${Math.round(o.centro*100)}% · D ${Math.round(o.dir*100)}%`, mem = game.memGoleiro?.(), pAgora = k.probAntes || (mem && probabilidades(mem)), hist = k.historico || mem?.historico || [];
      if (pAgora) L.push(`probabilidades da escolha (${k.idGoleiro || game.idGoleiro?.() || 'goleiro'}): ${pc(pAgora)}${k.probDepois ? ` → próxima: ${pc(k.probDepois)}` : ''}`);
      L.push(`histórico do goleiro: ${hist.length ? hist.slice(-8).map(d => ({ esq: 'E', centro: 'C', dir: 'D' })[d]).join(' ') : 'vazio'} · direção escolhida: ${k.lado || '—'}`); }
    L.push(`preparação: ${k.prepAntes != null ? `começou ${f(k.prepAntes)} s antes do contato previsto` : 'ainda não'}${k.prepAntesReal != null ? ` · pé na bola ${f(k.prepAntesReal)} s depois do início` : ''}`);
    if (p) { L.push(`ação: ${p.clip} (${p.tipo}) · ${p.motivoEscolha} · ${p.opcoes} opções avaliadas`); L.push(`clipe a partir de ${f(p.off)} s · iniciou ${f(p.tIni)} s após o chute · folga prevista ${Math.round(p.folgaPrevista*100)} cm${p.ajuste ? ` · ajuste do braço até ${Math.round(Math.max(...Object.values(p.ajuste).map(a => a.desloc))*100)} cm` : ''}`); }
    if (p?.intercepta) { const pr = k.plano.intercepta, faltaT = b ? pr.t - b.t : null; L.push(`interceptação prevista: ${pr.regiao} em (${pr.p.join(', ')}) · ${faltaT != null && faltaT > 0 ? 'faltam ' + f(faltaT) + ' s' : 'já passou'}`); }
    if (k.sensor && b && b.t > 0) { const S = k.sensor; L.push(`sensor: bola ${S.vel} m/s indo para ${S.regiao} · ponto previsto (${S.ponto.join(', ')}) erro ${Math.round(S.erro*100)} cm · faltam ${f(S.tempo)} s · parte mais perto: ${S.regiaoParte || '—'}${S.dist != null ? ` a ${Math.round(S.dist*100)} cm` : ''}`); }
    if (b && b.t > 0) L.push(`velocidade do goleiro: ${f(velocidadeGoleiro(k, b, keeperScale(game)))} m/s${p?.saiuAntes || k.log.some(l => /começa a sair/.test(l)) ? ' · saiu antes do chute' : ''}`);
    if (b && b.t > 0 && !ct) { const bp = ballFlight(b, b.t), m = cols0(); if (m) L.push(`bola → mão mais próxima: ${Math.round(m.d*100)} cm · bola a ${f(Math.hypot(bp[0] - KEEPER_CFG.raiz[0], bp[2] - KEEPER_CFG.raiz[2]))} m do goleiro`); }
    if (ct) { L.push(`contato: ${ct.nomeParte || ct.parte} (${ct.parte}) · ${defesaNome(ct)} · ${classe(ct.rotulo)} · ${ROTULOS[ct.rotulo] || ct.rotulo} · ${f(ct.vel)} → ${f(ct.vOutMod)} m/s`); L.push(`por quê: ${ct.motivo}`); }
    else if (k.sem) L.push(`sem contato: ${k.sem}`); else if (k.dmin) L.push(`mais perto até agora: ${Math.round(k.dmin.d*100)} cm (${k.dmin.parte})`);
    if (b && b.res) L.push(`resultado: ${b.res.toUpperCase()}`);
    c.save(); c.font = '12px ui-monospace, monospace'; const w = Math.max(...L.map(s => c.measureText(s).width)) + 16; c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(8, 78, w, L.length*16 + 10);
    c.textAlign = 'left'; L.forEach((s, i) => { c.fillStyle = i === 0 ? '#ffe66d' : '#e8f1ff'; c.fillText(s, 16, 96 + i*16); }); c.restore();
  }
  return { update, hud, group: g };
}
