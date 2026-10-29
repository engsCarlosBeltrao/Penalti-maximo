#!/usr/bin/env python3
"""Converte o pack "Brasil Kits 26-27 / 3D" (atlas 1024/2048 no layout do Football Manager) nas texturas do Pênalti Máximo.
Uso: python3 tools/build-kits.py <pasta com os *_3d.png> [pasta de saída = assets/kits]
Para cada clube/uniforme gera <key>_<home|away|third>.jpg (1024x768, layout "wrap" do uniform.js: frente em x=256, costas em x=768)
e kits.json com as cores de calção/meião/manga/detalhe. Os rótulos clube->ID foram conferidos pelo ESCUDO de cada camisa (o pack não traz nomes)."""
import sys, os, json
from PIL import Image, ImageFilter
from collections import Counter
CLUBS = {  # key do jogo -> ID do pack (conferido visualmente pelo escudo)
 'flamengo':'322','corinthians':'319','palmeiras':'329','saopaulo':'337','santos':'335','gremio':'324','internacional':'326',
 'atletico-mg':'314','cruzeiro':'321','botafogo':'316','fluminense':'323','vasco':'339','bahia':'315','sport':'338',
 'fortaleza':'104750','ceara':'104749','athletico-pr':'107206','coritiba':'104776','bragantino':'317','vitoria':'340'}
# regiões do atlas em frações da imagem (x0,y0,x1,y1)
FRONT = (.345, .600, .655, .995); BACK = (.345, .125, .655, .500)
SHORTS = (.03, .80, .31, .98); SOCKS = (.02, .46, .21, .66); SLEEVE = (.25, .44, .335, .68)
W, H, BODY = 1024, 768, 553   # layout WRAP do uniform.js: corpo v 0–.72, mangas v .74–.98 (esq. u≈.25, dir. u≈.75)
COLLAR_HALF, COLLAR_ROWS = 36, 46
COLLAR_EXTRA = {('coritiba', 'home'): (100, 36), ('bragantino', 'third'): (72, 64), ('corinthians', 'third'): (64, 36), ('ceara', 'third'): (56, 36)}   # uniformes cuja gola do atlas desce mais   # área central do topo (px) a limpar
PANEL_H = 508   # altura do painel dentro do corpo da camisa (a barra do modelo corta ~8% de baixo)
SLEEVE_Y, SLEEVE_H, SLEEVE_W = int(.74*H), int(.24*H), 287
SL_L = (0.0, 0.0, 0.345, 0.31); SL_R = (0.655, 0.0, 1.0, 0.31)   # peças de manga (inteiras, achatadas) do atlas; shoulder_end = lado da peça que fica no ombro
SHOULDER_END, SLEEVE_FRAC = 'left', 0.55
def box(im, r): w, h = im.size; return im.crop((int(r[0]*w), int(r[1]*h), int(r[2]*w), int(r[3]*h)))
def hexc(c):
    if max(c[:3]) < 56: g = sum(c[:3])//3; c = (g, g, g)   # quase preto: tira o tom (o fundo de alguns atlas é arroxeado)
    return '#%02x%02x%02x' % c[:3]
def dominant(im, skip=()):
    """Cor dominante: acha a faixa de cor mais comum e devolve a MÉDIA real dos pixels dela (o centro da faixa deixava tons tortos, ex. branco virava #e4fce4)."""
    s = im.convert('RGB').resize((48, 48)); px = list(s.getdata()); groups = {}
    for p in px: groups.setdefault((p[0]//24, p[1]//24, p[2]//24), []).append(p)
    mean = lambda g: tuple(round(sum(c[i] for c in g)/len(g)) for i in range(3))
    for k, g in sorted(groups.items(), key=lambda kv: -len(kv[1])):
        m = mean(g)
        if all(sum(abs(a-b) for a, b in zip(m, q)) > 70 for q in skip): return m
    return mean(max(groups.values(), key=len))
def fill_panel(canvas, panel, cx, flip):
    if flip: panel = panel.rotate(180)
    pw = 512; panel = panel.resize((pw, PANEL_H), Image.LANCZOS)   # o painel ocupa toda a volta frontal (costura a costura)
    x0 = cx - pw//2; canvas.paste(panel, (x0, 0))
    # laterais: repete a coluna da borda (a camisa continua para o lado em vez de ficar um buraco)
    for x in range(cx - 256, x0): canvas.paste(panel.crop((0, 0, 1, PANEL_H)), (x, 0))
    for x in range(x0 + pw, cx + 256): canvas.paste(panel.crop((pw-1, 0, pw, PANEL_H)), (x, 0))
    # abaixo do painel (parte escondida pela barra) repete a última linha
    row = canvas.crop((cx - 256, PANEL_H - 1, cx + 256, PANEL_H)); canvas.paste(row.resize((512, BODY - PANEL_H)), (cx - 256, PANEL_H))
def sleeve_band(cv, at, r, cx, mirror):
    """Manga: recorta a peça achatada do atlas (largura = comprimento do braço, altura = volta do braço), fica só com a parte do ombro até o fim da manga curta,
    gira 90° (comprimento vira vertical) e cola na faixa do braço."""
    p = box(at, r)
    if mirror: p = p.transpose(Image.FLIP_LEFT_RIGHT)   # peça direita é a espelhada da esquerda
    w = p.width; f = int(w * SLEEVE_FRAC)
    p = p.crop((0, 0, f, p.height)) if SHOULDER_END == 'left' else p.crop((w - f, 0, w, p.height))
    if SHOULDER_END == 'right': p = p.transpose(Image.FLIP_LEFT_RIGHT)       # ombro sempre à esquerda antes de girar
    p = p.rotate(-90, expand=True).resize((SLEEVE_W, SLEEVE_H), Image.LANCZOS)   # ombro em cima
    cv.paste(p, (cx - SLEEVE_W//2, SLEEVE_Y))
    # preenche acima/abaixo e dos lados da faixa com a cor da borda para não aparecer buraco
    top = p.crop((0, 0, SLEEVE_W, 1)).resize((SLEEVE_W, 6)); cv.paste(top, (cx - SLEEVE_W//2, SLEEVE_Y - 6))
# Correções pontuais de arte do atlas de origem: (clube, variante) -> (tom escuro indesejado, tom certo, tolerância)
FIXES = {('sport', 'third'): ((0x0c, 0x54, 0x6c), (0x0c, 0x6c, 0x9c), 22)}   # meia face da frente com "sombra" bem mais escura que o resto
def apply_fix(im, rule):
    bad, good, tol = rule; px = im.load()
    for y in range(BODY):
        for x in range(W):
            r, g, b = px[x, y]
            if abs(r - bad[0]) < tol and abs(g - bad[1]) < tol and abs(b - bad[2]) < tol: px[x, y] = good
    return im
def build(path, key=None):
    at = Image.open(path).convert('RGB'); cv = Image.new('RGB', (W, H))
    fill_panel(cv, box(at, FRONT), 256, False); fill_panel(cv, box(at, BACK), 768, True)
    # o recorte da frente pega a ponta de baixo da gola/plaquê do atlas (um "U"/bloco escuro sob o decote): troca por tecido liso tirado logo abaixo
    rows, half = COLLAR_EXTRA.get(key, (COLLAR_ROWS, COLLAR_HALF)); strip = cv.crop((256 - half, rows + 4, 256 + half, rows + 8)).resize((2*half, rows)); cv.paste(strip, (256 - half, 0))
    main = dominant(box(at, FRONT)); sleeve = dominant(box(at, SLEEVE)); cv.paste(sleeve, (0, BODY, W, H))
    for r, cx in ((SL_L, 256), (SL_R, 768)): sleeve_band(cv, at, r, cx, r is SL_R)
    shorts = dominant(box(at, SHORTS)); socks = dominant(box(at, SOCKS)); trim = dominant(box(at, FRONT), skip=[main])
    return cv, dict(main=hexc(main), sleeve=hexc(sleeve), shorts=hexc(shorts), socks=hexc(socks), trim=hexc(trim))
if __name__ == '__main__':
    src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'assets', 'kits'); os.makedirs(out, exist_ok=True)
    meta = {}
    for key, tid in CLUBS.items():
        for v in ('home', 'away', 'third'):
            f = os.path.join(src, f'{tid}_{v}_3d.png')
            if not os.path.exists(f): print('sem', key, v); continue
            im, c = build(f, (key, v))
            if (key, v) in FIXES: im = apply_fix(im, FIXES[(key, v)])
            im.save(os.path.join(out, f'{key}_{v}.jpg'), quality=90); meta.setdefault(key, {})[v] = dict(c, packId=tid, file=f'assets/kits/{key}_{v}.jpg')
    json.dump(meta, open(os.path.join(out, 'kits.json'), 'w'), indent=1, ensure_ascii=False); print('ok', sum(len(v) for v in meta.values()), 'uniformes,', len(meta), 'clubes')
