// NAVEGAÇÃO DOS MENUS PELOS BOTÕES (setas, avançar, voltar): foco espacial sobre os botões, cartões e campos da tela que estiver aberta — os menus
// existentes não mudam; o botão físico faz o mesmo que o clique. A escolha do vizinho é pura (testável): `vizinho(rects, atual, dir)`.
export const DIRS = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };
// rects: [{x, y, w, h}]; devolve o índice do item mais próximo na direção (cone de ±60°), ou o atual se não houver
export function vizinho(rects, atual, dir) {
  const [dx, dy] = DIRS[dir], c = r => [r.x + r.w/2, r.y + r.h/2], [ax, ay] = c(rects[atual] || rects[0]); let best = atual, bd = Infinity;
  rects.forEach((r, i) => { if (i === atual) return; const [bx, by] = c(r), vx = bx - ax, vy = by - ay, fr = vx*dx + vy*dy; if (fr <= 1) return;
    const lat = Math.abs(vx*dy - vy*dx); if (lat > fr*1.8) return; const d = fr + lat*2.2; if (d < bd) { bd = d; best = i; } });
  return best;
}
const SEL = 'button:not([hidden]):not([disabled]), .card, input:not([type=hidden]), select, [data-nav]';
const visivel = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
export class Navegador {
  constructor(raizes) { this.raizes = raizes; this.foco = null; }           // raizes(): elementos onde procurar, em ordem de prioridade (o 1º visível vence)
  raiz() { return this.raizes().find(r => r && visivel(r)) || null; }
  itens() { const r = this.raiz(); return r ? [...r.querySelectorAll(SEL)].filter(visivel) : []; }
  atual() { const it = this.itens(); if (!it.length) return null; if (!this.foco || !it.includes(this.foco)) this.marca(it[0]); return this.foco; }
  marca(e) { this.foco?.classList.remove('nav-foco'); this.foco = e; if (e) { e.classList.add('nav-foco'); e.focus?.({ preventScroll: false }); e.scrollIntoView?.({ block: 'nearest' }); } }
  mover(dir) {
    const e = this.atual(); if (!e) return false;
    if (dir === 'LEFT' || dir === 'RIGHT') {                                   // campos ajustáveis: setas laterais mudam o valor
      if (e.type === 'range') { const st = +e.step || 1, v = Math.min(+e.max, Math.max(+e.min, +e.value + (dir === 'RIGHT' ? st : -st))); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); return true; }
      if (e.tagName === 'SELECT') { const i = Math.min(e.options.length - 1, Math.max(0, e.selectedIndex + (dir === 'RIGHT' ? 1 : -1))); e.selectedIndex = i; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    }
    const it = this.itens(), i = it.indexOf(e), j = vizinho(it.map(x => { const r = x.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }), i, dir); if (j !== i) this.marca(it[j]); return j !== i;
  }
  confirmar() { const e = this.atual(); if (!e) return false; if (e.type === 'range' || e.tagName === 'SELECT') return false; e.click(); return true; }
  // VOLTAR: o botão "voltar/sair/menu" da tela (os menus já têm um); na tela inicial não faz nada
  voltar() { const r = this.raiz(); if (!r) return false; const b = [...r.querySelectorAll('button')].filter(visivel).find(x => x.dataset.voltar != null || /^(voltar|sair|menu|n[aã]o|cancelar)\b/i.test(x.textContent.trim()));
    if (!b) return false; b.click(); return true; }
}
