// DEPURAÇÃO DO GOLEIRO (tecla G ou ?debug=goleiro na URL): mostra os colisores presos aos ossos (os mesmos que a física usa, no instante do clipe
// que está na tela), o ponto em que o goleiro LEU que a bola cruzaria o plano do gol, o ponto real, a parte que tocou e um painel com a decisão, os tempos,
// o contato, as velocidades e o motivo de a defesa ter sido possível ou não. Desligado, nada aparece e nada muda no jogo.
import * as THREE from 'three';
import { DBG } from '../debug.js';
import { colisoresAgora, cruzamento, ROTULOS, KEEPER_CFG } from '../keeper.js';
import { keeperScale, flightTime } from '../frame.js';
const COR = { mao: 0x39ff14, antebraco: 0xc6ff00, braco: 0xffe600, tronco: 0x00e5ff, cabeca: 0x00b0ff, perna: 0xff9100, pe: 0xff6d00 }, TOQUE = 0xff1744;
export function createKeeperDebug(scene) {
  try { if (typeof location !== 'undefined' && /(^|[?&])debug=goleiro\b/.test(location.search)) DBG.goleiro = true; } catch { /* sem URL */ }
  if (typeof window !== 'undefined') window.addEventListener('keydown', e => { if (e.key === 'g' || e.key === 'G') DBG.goleiro = !DBG.goleiro; });
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), sph = new THREE.SphereGeometry(1, 12, 8), Y = new THREE.Vector3(0, 1, 0), parts = new Map();
  const mat = c => new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: .55, depthTest: false });
  const parte = n => { let p = parts.get(n); if (p) return p; const m = mat(0xffffff); p = { m, c: new THREE.Mesh(cyl, m), a: new THREE.Mesh(sph, m), b: new THREE.Mesh(sph, m) }; [p.c, p.a, p.b].forEach(o => { o.renderOrder = 999; g.add(o); }); parts.set(n, p); return p; };
  const ring = (c, r) => { const o = new THREE.Mesh(new THREE.RingGeometry(r*.75, r, 28), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: .9 })); o.renderOrder = 999; g.add(o); return o; };
  const lido = ring(0xff00ff, .2), real = ring(0xffffff, .14), toque = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({ color: TOQUE, depthTest: false })); toque.renderOrder = 999; g.add(toque);
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  function update(game, b, now) {
    g.visible = !!DBG.goleiro && !!game.m && !game.fin; if (!g.visible) return; const k = game.keeper; if (!k || !k.log) { g.visible = false; return; }
    const cols = colisoresAgora(k, b, now, keeperScale(game)), hit = k.contato && k.contato.parte;
    for (const c of cols) { const p = parte(c.nome); p.m.color.setHex(c.nome === hit ? TOQUE : COR[c.grupo]); va.set(...c.a); p.a.position.copy(va); p.a.scale.setScalar(c.r);
      if (c.b) { vb.set(...c.b); p.b.visible = p.c.visible = true; p.b.position.copy(vb); p.b.scale.setScalar(c.r); const d = vb.clone().sub(va), L = d.length(); p.c.position.copy(va).addScaledVector(d, .5); p.c.scale.set(c.r, L, c.r); p.c.quaternion.setFromUnitVectors(Y, d.normalize()); }
      else { p.b.visible = p.c.visible = false; } }
    lido.visible = !!k.plano; if (k.plano) lido.position.set(k.plano.lido.x, k.plano.lido.y, .02);
    real.visible = !!b; if (b) { const [x, y] = cruzamento(b); real.position.set(x, y, .03); }
    toque.visible = !!k.contato; if (k.contato) toque.position.set(...k.contato.ponto);
  }
  function hud(c, game, b) {
    if (!DBG.goleiro || !game.m || game.fin) return; const k = game.keeper; if (!k || !k.log) return;
    const p = k.plano, ct = k.contato, f = n => (n == null ? '—' : n.toFixed(2)), tf = b ? flightTime(b) : null, L = [];
    L.push('GOLEIRO · depuração (G liga/desliga)');
    L.push(`lado: ${k.lado || 'nenhum ainda'}${k.origem ? ` (${k.origem})` : ''} · ${k.travado ? `travado a ${f(-k.travadoEm)} s do chute` : `limite: ${KEEPER_CFG.decisaoAntes} s antes do chute`}${k.ignoradas.length ? ` · ${k.ignoradas.length} tentativa(s) depois do limite ignorada(s)` : ''}`);
    L.push(`tempo até o chute: ${b ? f(Math.max(0, -b.t)) : '—'} s · até a linha do gol: ${b ? f(Math.max(0, tf - b.t)) : '—'} s${ct ? ` · contato em t=${f(ct.t)} s` : ''}`);
    if (b) { const [x, y] = cruzamento(b); L.push(`cruzamento real: x=${f(x)} y=${f(y)} m${p ? ` (${p.real})` : ''}${p ? ` · leitura do goleiro: ${p.lido.cat} (x=${f(p.lido.x)} y=${f(p.lido.y)})` : ''}`); }
    L.push(`preparação: ${k.prepAntes != null ? `começou ${f(k.prepAntes)} s antes do contato previsto` : 'ainda não'}${k.prepAntesReal != null ? ` · pé na bola ${f(k.prepAntesReal)} s depois do início` : ''}`);
    if (p) { L.push(`ação: ${p.clip} (${p.tipo}) · ${p.motivoEscolha} · ${p.opcoes} opções avaliadas`); L.push(`clipe a partir de ${f(p.off)} s · iniciou ${f(p.tIni)} s após o chute · folga prevista ${Math.round(p.folgaPrevista*100)} cm${p.ajuste ? ` · ajuste do braço até ${Math.round(Math.max(...Object.values(p.ajuste).map(a => a.desloc))*100)} cm` : ''}`); }
    if (ct) { L.push(`contato: ${ct.parte} · ${ROTULOS[ct.rotulo] || ct.rotulo} · ${f(ct.vel)} → ${f(ct.vOutMod)} m/s`); L.push(`por quê: ${ct.motivo}`); }
    else if (k.sem) L.push(`sem contato: ${k.sem}`); else if (k.dmin) L.push(`mais perto até agora: ${Math.round(k.dmin.d*100)} cm (${k.dmin.parte})`);
    if (b && b.res) L.push(`resultado: ${b.res.toUpperCase()}`);
    c.save(); c.font = '12px ui-monospace, monospace'; const w = Math.max(...L.map(s => c.measureText(s).width)) + 16; c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(8, 78, w, L.length*16 + 10);
    c.textAlign = 'left'; L.forEach((s, i) => { c.fillStyle = i === 0 ? '#ffe66d' : '#e8f1ff'; c.fillText(s, 16, 96 + i*16); }); c.restore();
  }
  return { update, hud, group: g };
}
