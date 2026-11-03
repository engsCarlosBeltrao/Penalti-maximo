# ENTRADA (caminhada até o ponto de partida), 5 COMEMORAÇÕES de gol e 5 REAÇÕES de cobrança perdida — Blender 5.2, modo background,
# no ESQUELETO do athlete.glb (sai só esqueleto + clipe; o modelo não é reexportado). Mesma técnica de tools/blender/cobranca.py e repouso.py:
#  - pés por IK de 2 ossos com apoios TRAVADOS no gramado (calcanhar sobe girando sobre os dedos; no balanço o pé sobe em arco e desce de calcanhar);
#  - pelve/coluna/cabeça por curvas monótonas (pchip), com o alcance da perna de apoio respeitado (a pelve só abaixa o necessário);
#  - braços, mãos e dedos por tools/blender/bracos.py: cotovelo-dobradiça (sem torção arbitrária), punho que só dobra, dedos pelos eixos reais
#    (relaxada, punho, aponta, aberta); mãos que tocam o corpo (cintura, rosto, cabeça) por IK analítico com alvo afastado da geometria;
#  - bake visual (bake_action.py); o canhoto é o espelho exato osso a osso.
# Referencial do clipe: o do CORPO (de frente para -Y, esquerda = +X). ENTRADA termina com a pelve na origem e os pés na pose de espera;
# as reações começam com a pelve na origem e os pés como no fim das cobranças.
# Uso: blender -b --factory-startup --python-exit-code 1 -P tools/blender/reacoes.py -- assets/models/athlete.glb assets/models/anim .claude/skills [nomes,separados]
import bpy, sys, os, json, math
from mathutils import Vector, Matrix, Quaternion
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import bracos as BR

args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT_DIR, SKILLS = args[0], args[1], args[2]
FPS = 30
D = math.radians

def pchip(keys):                                                     # cúbica monótona (Fritsch–Carlson): sem overshoot
    ts = sorted(keys); vs = [keys[t] for t in ts]
    def scalar(xs, ys):
        n = len(xs)
        if n == 1: return lambda x: ys[0]
        h = [xs[i + 1] - xs[i] for i in range(n - 1)]; dl = [(ys[i + 1] - ys[i])/h[i] for i in range(n - 1)]
        m = [dl[0]] + [0.0]*(n - 2) + [dl[-1]]
        for i in range(1, n - 1):
            if dl[i - 1]*dl[i] <= 0: m[i] = 0.0
            else: w1, w2 = 2*h[i] + h[i - 1], h[i] + 2*h[i - 1]; m[i] = (w1 + w2)/(w1/dl[i - 1] + w2/dl[i])
        def f(x):
            if x <= xs[0]: return ys[0]
            if x >= xs[-1]: return ys[-1]
            i = max(k for k in range(n - 1) if xs[k] <= x); u = (x - xs[i])/h[i]
            return (2*u**3 - 3*u**2 + 1)*ys[i] + (u**3 - 2*u**2 + u)*h[i]*m[i] + (-2*u**3 + 3*u**2)*ys[i + 1] + (u**3 - u**2)*h[i]*m[i + 1]
        return f
    if isinstance(vs[0], (tuple, list)): fs = [scalar(ts, [v[k] for v in vs]) for k in range(len(vs[0]))]; return lambda x: tuple(f(x) for f in fs)
    return scalar(ts, vs)
rot = lambda yaw=0, lean=0, tilt=0: Matrix.Rotation(D(yaw), 3, "Z") @ Matrix.Rotation(D(lean), 3, "X") @ Matrix.Rotation(D(tilt), 3, "Y")
V = lambda x, y: Vector((x, y, 0))

# ---- poses de referência (referencial do corpo) ----
IDLE_R, IDLE_L = rot(35) @ Vector((-.144, .148, 0)), rot(35) @ Vector((.188, -.084, 0))   # pés da espera (= repouso e 1º quadro das cobranças)
END_R, END_L = V(-.15, .03), V(.15, -.03)                                                  # pés no fim da cobrança (relativos à pelve)
HANG = lambda s: ((s*.13, -.04, -1), (s*.10, -.30, -.95))                                  # braço solto (o do repouso)
WFWD = lambda s, k: ((s*.10, -.30*k, -.95), (s*.05, -.62*k - .1, -.80))                   # caminhada: braço à frente (cotovelo ~25°)
WBCK = lambda s, k: ((s*.12, .30*k, -.95), (s*.10, .08*k - .12, -.99))                    # caminhada: braço atrás
RFWD = lambda s: ((s*.10, -.55, -.83), (-s*.15, -.86, .45))                                # corrida: braço à frente (cotovelo ~90°)
RBCK = lambda s: ((s*.18, .62, -.76), (s*.05, -.55, -.83))                                 # corrida: braço atrás

def caminho(yaw):                                                    # pontos de um caminho reto a partir da origem, girado yaw graus, com lado (+1 esq / -1 dir)
    A = lambda d: rot(yaw) @ Vector((0, -d, 0))
    sd = lambda d, s, dy=0: A(d) + rot(yaw) @ Vector((s*.11, dy, 0))
    c = lambda d, z, dx=0: tuple((A(d) + rot(yaw) @ Vector((dx, 0, 0))).xy) + (z,)
    return A, sd, c

def plano(nome, T, steps, pel, prot, crot, head, arms, ik=None, maos=None, init=None):
    return dict(nome=nome, T=T, steps=steps, init=init or {"r": (END_R, 0), "l": (END_L, 0)}, pel=pel, prot=prot, crot=crot, head=head, arms=arms,
                ik=ik or {}, maos=maos or {"l": {0: ("relaxada", 1)}, "r": {0: ("relaxada", 1)}})

# ======================= ENTRADA =======================
def plano_entrada():
    """Caminha ~2 m até o ponto de espera, desacelerando; o penúltimo passo ajusta, o último fecha a base."""
    P0 = 1.98
    steps = {"r": [(.04, .48, V(-.10, P0 + .04), V(-.10, 1.40), -3), (1.03, 1.48, V(-.10, 1.40), V(-.10, .30), -3), (2.02, 2.36, V(-.10, .30), IDLE_R, -3.0)],
             "l": [(.53, .98, V(.10, P0 + .04), V(.10, .80), 3), (1.53, 1.98, V(.10, .80), IDLE_L, 3.1)]}
    pel = {0: (0, P0, .93), .2: (0, P0 - .07, .925), .48: (-.02, 1.63, .905), .73: (-.025, 1.33, .93), .98: (.02, 1.03, .905), 1.23: (.025, .76, .93),
           1.48: (-.02, .50, .905), 1.73: (-.02, .30, .925), 1.98: (.015, .14, .91), 2.17: (.01, .07, .922), 2.36: (0, .03, .92), 2.55: (0, .01, .926), 2.7: (0, 0, .926)}
    prot = {0: (0, 2, 0), .48: (-4, 5, -2), .98: (4, 5, 2), 1.48: (-4, 5, -2), 1.98: (3, 4, 1.5), 2.36: (-1, 3.5, 0), 2.7: (0, 3.2, 0)}
    crot = {0: (0, 4, 0), .48: (5, 6, 1), .98: (-5, 6, -1), 1.48: (5, 6, 1), 1.98: (-3, 5.5, -.5), 2.36: (1, 5, 0), 2.7: (0, 5, 0)}
    head = {0: (12, 0), .98: (14, 0), 1.6: (18, 0), 2.2: (21, 0), 2.7: (22, 0)}
    k = lambda t: 1 if t < 1.6 else max(.25, 1 - (t - 1.6)/1.0)
    arms = {"l": {0: HANG(1), .48: WFWD(1, k(.48)), .98: WBCK(1, k(.98)), 1.48: WFWD(1, k(1.48)), 1.98: WBCK(1, k(1.98)), 2.36: HANG(1), 2.7: HANG(1)},
            "r": {0: HANG(-1), .48: WBCK(-1, k(.48)), .98: WFWD(-1, k(.98)), 1.48: WBCK(-1, k(1.48)), 1.98: WFWD(-1, k(1.98)), 2.36: HANG(-1), 2.7: HANG(-1)}}
    return plano("Entrada", 2.7, steps, pel, prot, crot, head, arms, init={"r": (V(-.10, P0 + .04), 0), "l": (V(.10, P0 + .04), 0)})

# ======================= 5 COMEMORAÇÕES =======================
def gol_bracos_abertos():
    """Abre os braços como asas e caminha alguns passos girando, peito aberto e cabeça erguida; depois os braços descem."""
    Y = 35; A, sd, c = caminho(Y)
    steps = {"r": [(.35, .65, END_R, sd(.45, -1), 20), (.95, 1.25, sd(.45, -1), sd(1.20, -1), Y)], "l": [(.65, .95, END_L, sd(.85, 1), 28), (1.25, 1.55, sd(.85, 1), sd(1.32, 1, -.05), Y)]}
    pel = {0: (0, 0, .93), .3: (0, .01, .91), .65: c(.30, .905), .80: c(.50, .93), .95: c(.68, .905), 1.10: c(.88, .93), 1.25: c(1.05, .91), 1.55: c(1.22, .92), 2.0: c(1.26, .928), 3.2: c(1.27, .926)}
    prot = {0: (0, 6, 0), .65: (10, 4, -2), .95: (Y - 6, 3, 2), 1.25: (Y + 4, 2, -2), 1.55: (Y, 1, 0), 3.2: (Y, 3, 0)}
    crot = {0: (0, 10, 0), .4: (4, 2, 0), .95: (Y - 2, -6, 1), 1.6: (Y + 2, -9, -1), 2.3: (Y, -7, 0), 2.8: (Y, 2, 0), 3.2: (Y, 5, 0)}
    head = {0: (20, 0), .5: (2, 0), 1.0: (-10, 6), 1.6: (-14, -6), 2.3: (-8, 0), 2.8: (8, 0), 3.2: (14, 0)}
    ASA = lambda s, up: ((s*.95, -.08, up), (s*.92, -.22, up + .12))
    arms = {s: {0: HANG(g), .45: ((g*.55, -.2, -.65), (g*.55, -.35, -.5)), 1.0: ASA(g, .12), 1.6: ASA(g, .28), 2.3: ASA(g, .18), 2.8: ((g*.4, -.1, -.85), (g*.3, -.35, -.85)), 3.2: HANG(g)}
            for s, g in (("l", 1), ("r", -1))}
    arms["r"][1.6] = ASA(-1, .36)                                     # assimetria: o braço direito sobe um pouco mais
    maos = {s: {0: ("relaxada", 1), .7: ("aberta", .8), 2.4: ("aberta", .8), 2.9: ("relaxada", 1)} for s in "lr"}
    return plano("GolBracosAbertos", 3.2, steps, pel, prot, crot, head, arms, maos=maos)

def gol_punhos():
    """Fica no lugar: agacha, cerra os punhos e puxa os dois braços duas vezes ("vamos!"), tronco e cabeça acompanhando; relaxa com um ajuste de pé."""
    steps = {"r": [], "l": [(1.95, 2.25, END_L, END_L + V(.03, .07), 6)]}
    pel = {0: (0, 0, .93), .2: (0, .02, .87), .45: (0, .01, .895), .7: (0, .02, .865), .95: (0, .01, .895), 1.2: (0, .02, .87), 1.6: (0, .01, .91), 2.25: (.02, .03, .924), 2.8: (.02, .03, .926)}
    prot = {0: (0, 6, 0), .2: (0, 14, 0), .45: (-4, 10, 0), .7: (0, 16, 0), .95: (4, 10, 0), 1.2: (0, 15, 0), 1.6: (0, 7, 0), 2.8: (3, 4, 0)}
    crot = {0: (0, 10, 0), .2: (0, 24, 0), .45: (-6, 12, 2), .7: (0, 26, 0), .95: (6, 12, -2), 1.2: (0, 22, 0), 1.6: (0, 8, 0), 2.8: (2, 6, 0)}
    head = {0: (20, 0), .2: (-6, 0), .45: (-14, 0), .7: (-4, 0), .95: (-14, 0), 1.2: (-6, 0), 1.7: (6, 0), 2.8: (14, 0)}
    UP = lambda s: ((s*.48, -.18, -.86), (s*.18, -.30, .94))          # punho na altura do ombro, antebraço em pé, cotovelo ~95°
    DOWN = lambda s: ((s*.32, .12, -.94), (s*.22, -.62, .75))         # puxada: cotovelo para trás, punho junto ao peito
    arms = {s: {0: HANG(g), .28: UP(g), .5: DOWN(g), .74: UP(g), .98: DOWN(g), 1.22: UP(g), 1.7: ((g*.3, -.1, -.9), (g*.2, -.5, -.8)), 2.4: HANG(g), 2.8: HANG(g)}
            for s, g in (("l", 1), ("r", -1))}
    maos = {s: {0: ("relaxada", 1), .15: ("punho", 1), 1.5: ("punho", 1), 2.1: ("relaxada", 1)} for s in "lr"}
    return plano("GolPunhos", 2.8, steps, pel, prot, crot, head, arms, maos=maos)

def gol_salto():
    """Dois passos rápidos, salto com os dois pés e os braços para cima (um mais alto), aterrissa amortecendo, ajusta e relaxa."""
    Y = 15; A, sd, c = caminho(Y)
    steps = {"r": [(.25, .50, END_R, sd(.42, -1), Y), (1.00, 1.32, sd(.42, -1), sd(1.02, -1), Y), (1.95, 2.2, sd(1.02, -1), sd(1.06, -1, .04), Y)],
             "l": [(.45, .72, END_L, sd(.82, 1), Y), (1.00, 1.32, sd(.82, 1), sd(1.10, 1), Y)]}
    pel = {0: (0, 0, .93), .5: c(.30, .905), .72: c(.62, .925), .92: c(.84, .845), 1.16: c(.97, 1.03), 1.32: c(1.04, .86), 1.55: c(1.05, .905), 2.0: c(1.07, .924), 3.0: c(1.08, .926)}
    prot = {0: (0, 6, 0), .5: (Y - 4, 8, -2), .72: (Y + 4, 8, 2), .92: (Y, 16, 0), 1.16: (Y, -4, 0), 1.32: (Y, 14, 0), 1.6: (Y, 6, 0), 3.0: (Y, 3, 0)}
    crot = {0: (0, 10, 0), .5: (Y + 5, 10, 1), .72: (Y - 5, 10, -1), .92: (Y, 24, 0), 1.16: (Y + 4, -10, -3), 1.32: (Y, 14, 0), 1.7: (Y, 2, 0), 2.4: (Y, 4, 0), 3.0: (Y, 6, 0)}
    head = {0: (20, 0), .6: (6, 0), .92: (10, 0), 1.16: (-24, 0), 1.4: (-12, 0), 2.0: (-4, 0), 2.6: (10, 0), 3.0: (14, 0)}
    arms = {"l": {0: HANG(1), .5: RBCK(1), .66: ((.15, .2, -.97), (.1, -.1, -.99)), .86: ((.2, .55, -.8), (.1, .3, -.95)), 1.04: ((.3, -.9, -.1), (.25, -.95, .15)), 1.24: ((.38, -.1, .92), (.22, -.12, .97)), 1.46: ((.40, -.12, .90), (.26, -.2, .94)),
                  1.9: ((.6, -.3, -.2), (.5, -.6, .2)), 2.5: ((.3, -.1, -.9), (.2, -.4, -.85)), 3.0: HANG(1)},
            "r": {0: HANG(-1), .5: RFWD(-1), .66: ((-.15, .2, -.97), (-.1, -.1, -.99)), .86: ((-.2, .55, -.8), (-.1, .3, -.95)), 1.04: ((-.3, -.9, -.1), (-.25, -.95, .15)), 1.24: ((-.25, -.35, .90), (-.14, -.42, .90)), 1.46: ((-.3, -.3, .85), (-.2, -.45, .85)),
                  1.9: ((-.6, -.3, -.3), (-.5, -.6, .1)), 2.5: ((-.3, -.1, -.9), (-.2, -.4, -.85)), 3.0: HANG(-1)}}
    maos = {s: {0: ("relaxada", 1), .85: ("punho", 1), 1.9: ("punho", 1), 2.4: ("relaxada", 1)} for s in "lr"}
    return plano("GolSalto", 3.0, steps, pel, prot, crot, head, arms, maos=maos)

def gol_aponta():
    """Ergue o braço direito e aponta o indicador para o céu, olhando para cima; a outra mão no peito; dá dois passos lentos e baixa o braço."""
    Y = -20; A, sd, c = caminho(Y)
    steps = {"l": [(.50, .85, END_L, sd(.32, 1), Y), (1.6, 1.9, sd(.32, 1), sd(.70, 1), Y)], "r": [(1.0, 1.35, END_R, sd(.62, -1), Y)]}
    pel = {0: (0, 0, .93), .5: (0, .02, .915), .85: c(.20, .925), 1.35: c(.48, .924), 1.9: c(.66, .926), 3.0: c(.68, .926)}
    prot = {0: (0, 6, 0), .85: (Y + 3, 4, 2), 1.35: (Y - 3, 3, -2), 1.9: (Y, 2, 0), 3.0: (Y, 3, 0)}
    crot = {0: (0, 10, 0), .6: (-6, 2, 3), 1.2: (Y - 8, -8, 4), 2.2: (Y - 6, -8, 3), 2.7: (Y, 2, 0), 3.0: (Y, 5, 0)}
    head = {0: (20, 0), .6: (0, 0), 1.0: (-30, -4), 2.2: (-28, -6), 2.6: (0, 0), 3.0: (14, 0)}
    arms = {"r": {0: HANG(-1), .35: ((-.35, -.25, -.1), (-.25, -.35, .55)), .85: ((-.16, -.12, .98), (-.08, -.10, .99)), 1.5: ((-.18, -.14, .97), (-.08, -.12, .99)),
                  2.2: ((-.16, -.12, .98), (-.08, -.10, .99)), 2.6: ((-.35, -.15, -.5), (-.25, -.45, -.4)), 3.0: HANG(-1)},
            "l": {0: HANG(1), 3.0: HANG(1)}}
    ik = {"l": {0: ("peito", 0), .4: ("peito", 0), .9: ("peito", 1), 2.2: ("peito", 1), 2.7: ("peito", 0), 3.0: ("peito", 0)}}
    maos = {"r": {0: ("relaxada", 1), .5: ("aponta", 1), 2.3: ("aponta", 1), 2.7: ("relaxada", 1)}, "l": {0: ("relaxada", 1), .9: ("aberta", .6), 2.2: ("aberta", .6), 2.7: ("relaxada", 1)}}
    return plano("GolAponta", 3.0, steps, pel, prot, crot, head, arms, ik=ik, maos=maos)

def gol_corrida():
    """Corre comemorando em arco, braços de corrida alternados, desacelera, ergue os dois punhos e relaxa."""
    Y = 55; A, sd, c = caminho(Y)
    d = [.55, 1.20, 1.85, 2.45, 2.95, 3.25, 3.35]                     # passadas crescem e depois encurtam (desaceleração)
    tt = [(.15, .40), (.40, .66), (.66, .92), (.92, 1.20), (1.20, 1.50), (1.55, 1.85), (1.95, 2.25)]
    feet = ["r", "l", "r", "l", "r", "l", "r"]; steps = {"r": [], "l": []}; prev = {"r": END_R, "l": END_L}
    for i, (f, (a, b)) in enumerate(zip(feet, tt)):
        p = sd(d[i], -1 if f == "r" else 1); steps[f].append((a, b, prev[f], p, Y if i > 0 else Y/2)); prev[f] = p
    pel = {0: (0, 0, .93), .15: (0, .02, .91)}
    for i, (a, b) in enumerate(tt): pel[b] = c(d[i] - .08, .885 if i < 5 else .91); pel[(a + b)/2 + .02] = c(d[i] - .38 if i else .25, .935 if i < 5 else .925)
    pel.update({2.5: c(3.30, .924), 3.4: c(3.32, .926)})
    prot = {0: (0, 6, 0), .4: (Y/2, 12, 0), .9: (Y, 14, 0), 1.5: (Y, 10, 0), 2.0: (Y, 5, 0), 3.4: (Y, 3, 0)}
    crot = {0: (0, 10, 0), .4: (Y/2 + 4, 14, 0), .66: (Y - 6, 15, 0), .92: (Y + 6, 15, 0), 1.2: (Y - 6, 13, 0), 1.5: (Y + 4, 10, 0), 2.1: (Y, -6, 0), 2.7: (Y, -4, 0), 3.4: (Y, 5, 0)}
    head = {0: (20, 0), .4: (4, 0), 1.5: (2, 0), 2.1: (-16, 0), 2.7: (-10, 0), 3.4: (14, 0)}
    arms = {"l": {0: HANG(1)}, "r": {0: HANG(-1)}}
    for (a, b), f in zip(tt[:6], feet[:6]):                          # braço oposto à perna que avança
        fl, bl = ("l", "r") if f == "r" else ("r", "l"); arms[fl][b] = RFWD(1 if fl == "l" else -1); arms[bl][b] = RBCK(1 if bl == "l" else -1)
    for s, g in (("l", 1), ("r", -1)): arms[s].update({2.08: ((g*.3, -.5, -.8), (g*.2, -.85, .1)), 2.38: ((g*.32, -.1, .94), (g*.2, -.18, .96)), 2.65: ((g*.34, -.12, .93), (g*.22, -.2, .95)), 3.1: ((g*.3, -.1, -.88), (g*.2, -.4, -.85)), 3.4: HANG(g)})
    maos = {s: {0: ("relaxada", 1), .4: ("punho", .5), 1.9: ("punho", 1), 2.8: ("punho", 1), 3.2: ("relaxada", 1)} for s in "lr"}
    return plano("GolCorrida", 3.4, steps, pel, prot, crot, head, arms, maos=maos)

# ======================= 5 REAÇÕES DE COBRANÇA PERDIDA =======================
def perdeu_cabeca_baixa():
    """A cabeça cai devagar, os ombros relaxam e caem, os braços ficam pesados; um passo curto para trás, solta o ar e ergue um pouco a cabeça."""
    steps = {"r": [(1.1, 1.45, END_R, END_R + V(-.02, .22), -8)], "l": []}
    pel = {0: (0, 0, .93), .5: (0, .02, .915), 1.1: (0, .03, .912), 1.45: (-.03, .11, .91), 2.2: (-.01, .12, .918), 2.8: (-.01, .12, .924)}
    prot = {0: (0, 6, 0), .6: (-2, 10, 0), 1.45: (-8, 8, -1), 2.8: (-5, 5, 0)}
    crot = {0: (0, 10, 0), .6: (-2, 26, 0), 1.4: (-6, 30, 2), 2.2: (-5, 22, 0), 2.8: (-4, 14, 0)}
    head = {0: (20, 0), .6: (42, 0), 1.4: (48, -4), 2.2: (40, 0), 2.8: (30, 0)}
    PESADO = lambda s: ((s*.08, -.12, -1), (s*.06, -.2, -1))
    arms = {s: {0: HANG(g), .6: PESADO(g), 2.2: PESADO(g), 2.8: HANG(g)} for s, g in (("l", 1), ("r", -1))}
    return plano("PerdeuCabecaBaixa", 2.8, steps, pel, prot, crot, head, arms)

def perdeu_maos_cintura():
    """As duas mãos vão à cintura, o peso passa de uma perna para a outra, olha o gol e depois o chão; solta as mãos e relaxa."""
    steps = {"l": [(1.5, 1.8, END_L, END_L + V(.05, .10), 8)], "r": []}
    pel = {0: (0, 0, .93), .5: (-.02, .02, .92), 1.1: (-.035, .02, .918), 1.8: (.03, .06, .918), 2.4: (.02, .06, .922), 3.0: (.02, .06, .926)}
    prot = {0: (0, 6, 0), .5: (-4, 4, -3), 1.1: (-6, 3, -4), 1.8: (6, 3, 4), 2.4: (4, 4, 2), 3.0: (2, 4, 0)}
    crot = {0: (0, 10, 0), .5: (-6, 2, -2), 1.1: (-8, -2, -3), 1.8: (6, 8, 2), 2.4: (4, 10, 0), 3.0: (2, 6, 0)}
    head = {0: (20, 0), .5: (4, -6), 1.2: (0, -8), 1.8: (30, 4), 2.4: (24, 0), 3.0: (16, 0)}
    arms = {s: {0: HANG(g), 3.0: HANG(g)} for s, g in (("l", 1), ("r", -1))}
    ik = {s: {0: ("cintura", 0), .25: ("cintura", 0), .7: ("cintura", 1), 2.2: ("cintura", 1), 2.7: ("cintura", 0), 3.0: ("cintura", 0)} for s in "lr"}
    maos = {s: {0: ("relaxada", 1), .45: ("cintura", 1), 2.3: ("cintura", 1), 2.75: ("relaxada", 1)} for s in "lr"}
    return plano("PerdeuMaosCintura", 3.0, steps, pel, prot, crot, head, arms, ik=ik, maos=maos)

def perdeu_mao_rosto():
    """Freia o corpo e leva a mão direita ao rosto (palma na testa) por um instante, cabeça baixa; a mão desce, um passo atrás e relaxa."""
    steps = {"r": [(1.35, 1.70, END_R, END_R + V(-.04, .24), -10)], "l": []}
    pel = {0: (0, 0, .93), .35: (0, .02, .905), .9: (.01, .02, .912), 1.35: (0, .03, .915), 1.70: (-.04, .12, .91), 2.3: (-.02, .13, .922), 2.8: (-.02, .13, .926)}
    prot = {0: (0, 6, 0), .35: (-3, 9, 0), .9: (-6, 7, 2), 1.7: (-12, 4, -2), 2.8: (-6, 4, 0)}
    crot = {0: (0, 10, 0), .35: (-2, 20, 0), .9: (-8, 18, 3), 1.35: (-10, 12, 2), 1.7: (-14, 8, -2), 2.3: (-8, 6, 0), 2.8: (-5, 7, 0)}
    head = {0: (20, 0), .35: (34, 0), .9: (30, -6), 1.3: (28, -4), 1.7: (22, 6), 2.3: (16, 2), 2.8: (18, 0)}
    arms = {"l": {0: HANG(1), .5: ((.2, -.05, -.98), (.16, -.2, -.97)), 2.8: HANG(1)}, "r": {0: HANG(-1), 2.8: HANG(-1)}}
    ik = {"r": {0: ("rosto", 0), .3: ("rosto", 0), .7: ("rosto", 1), 1.25: ("rosto", 1), 1.75: ("rosto", 0), 2.8: ("rosto", 0)}}
    maos = {"r": {0: ("relaxada", 1), .6: ("aberta", .7), 1.3: ("aberta", .7), 1.8: ("relaxada", 1)}, "l": {0: ("relaxada", 1)}}
    return plano("PerdeuMaoRosto", 2.8, steps, pel, prot, crot, head, arms, ik=ik, maos=maos)

def perdeu_maos_cabeca():
    """As duas mãos vão à cabeça (cotovelos abertos), a cabeça vai um pouco para trás e depois baixa; dá um passo atrás e solta os braços."""
    steps = {"r": [(1.2, 1.55, END_R, END_R + V(-.03, .22), -8)], "l": [(1.9, 2.2, END_L, END_L + V(.02, .10), 6)]}
    pel = {0: (0, 0, .93), .4: (0, .02, .918), .9: (0, .02, .922), 1.2: (0, .03, .92), 1.55: (-.03, .11, .915), 2.2: (-.01, .14, .922), 3.0: (-.01, .14, .926)}
    prot = {0: (0, 6, 0), .45: (0, 0, 0), 1.0: (2, -2, 0), 1.55: (-8, 4, -1), 2.2: (-4, 5, 0), 3.0: (-3, 4, 0)}
    crot = {0: (0, 10, 0), .45: (0, -4, 0), 1.0: (2, -8, 0), 1.55: (-8, 8, 0), 2.2: (-6, 14, 0), 2.7: (-4, 10, 0), 3.0: (-3, 7, 0)}
    head = {0: (20, 0), .45: (-4, 0), 1.0: (-14, 0), 1.55: (20, 4), 2.2: (32, 0), 2.7: (22, 0), 3.0: (18, 0)}
    arms = {s: {0: HANG(g), 3.0: HANG(g)} for s, g in (("l", 1), ("r", -1))}
    ik = {s: {0: ("cabeca", 0), .15: ("cabeca", 0), .7: ("cabeca", 1), 1.9: ("cabeca", 1), 2.55: ("cabeca", 0), 3.0: ("cabeca", 0)} for s in "lr"}
    maos = {s: {0: ("relaxada", 1), .4: ("apoio", 1), 1.9: ("apoio", 1), 2.4: ("relaxada", 1)} for s in "lr"}
    return plano("PerdeuMaosCabeca", 3.0, steps, pel, prot, crot, head, arms, ik=ik, maos=maos)

def perdeu_olha_chao():
    """Vira de costas para o gol em três passos curtos olhando para o chão, respira fundo (peito sobe e desce), ajusta a postura e relaxa."""
    Y1, Y2 = -45, -100                                                # giro em dois tempos (sobre a perna esquerda, depois fecha com a direita)
    R1, R2 = rot(Y1), rot(Y2)
    steps = {"l": [(.55, .9, END_L, R1 @ END_L + V(.03, .03), Y1), (1.85, 2.15, R1 @ END_L + V(.03, .03), R2 @ END_L + V(.02, .05), Y2)],
             "r": [(1.15, 1.5, END_R, R2 @ END_R + V(.02, .05), Y2 + 6)]}
    pel = {0: (0, 0, .93), .55: (0, .01, .918), .9: (.01, .02, .92), 1.5: (.01, .04, .918), 2.15: (.02, .05, .924), 3.0: (.02, .05, .926)}
    prot = {0: (0, 6, 0), .55: (-5, 8, 0), .9: (Y1, 8, 2), 1.5: (Y2 + 10, 10, -2), 2.15: (Y2, 5, 0), 3.0: (Y2, 4, 0)}
    crot = {0: (0, 10, 0), .55: (-8, 22, 0), .9: (Y1 - 4, 26, 0), 1.5: (Y2 + 6, 24, 0), 1.9: (Y2, 6, 0), 2.3: (Y2, 16, 0), 2.7: (Y2, 8, 0), 3.0: (Y2, 6, 0)}   # 1,9 s: enche o peito; 2,3 s: solta o ar
    head = {0: (20, 0), .55: (44, -8), 1.2: (48, 6), 1.9: (30, 0), 2.3: (40, -4), 3.0: (24, 0)}
    arms = {s: {0: HANG(g), .5: ((g*.15, -.25, -.96), (g*.10, -.35, -.93)), 1.2: ((g*.18, .05, -.98), (g*.12, -.15, -.98)), 1.9: ((g*.2, -.05, -.98), (g*.14, -.2, -.97)), 2.4: HANG(g), 3.0: HANG(g)}
            for s, g in (("l", 1), ("r", -1))}
    return plano("PerdeuOlhaChao", 3.0, steps, pel, prot, crot, head, arms)

PLANOS = {"entrada": plano_entrada,
          "gol_bracos_abertos": gol_bracos_abertos, "gol_punhos": gol_punhos, "gol_salto": gol_salto, "gol_aponta": gol_aponta, "gol_corrida": gol_corrida,
          "perdeu_cabeca_baixa": perdeu_cabeca_baixa, "perdeu_maos_cintura": perdeu_maos_cintura, "perdeu_mao_rosto": perdeu_mao_rosto,
          "perdeu_maos_cabeca": perdeu_maos_cabeca, "perdeu_olha_chao": perdeu_olha_chao}

def build(plan, out_name, mirror):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    assert bpy.ops.import_scene.gltf(filepath=SRC) == {"FINISHED"}
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    HEADS = {}
    for o in bpy.data.objects:                                       # raio da cabeça pela malha de pele presa ao osso Head (para a mão não atravessar o rosto)
        if o.type != "MESH" or o.name.split("_")[0] in ("Hair", "Beard", "Must", "Side", "Acc", "Eyebrows", "Eyes"): continue   # só a pele (cabelo/barba são variantes)
        gi = {g.index: g.name for g in o.vertex_groups}
        for v in o.data.vertices:
            g_ = max(v.groups, key=lambda g: g.weight) if v.groups else None
            if g_ and gi.get(g_.group) == "Head":
                HEADS.setdefault("p", []).append(o.matrix_world @ v.co)
    CORPO = BR.Corpo(list(bpy.data.objects), arm)   # pele por osso: dedos não entram na cabeça, no tronco nem no quadril
    for o in [o for o in bpy.data.objects if o != arm]: bpy.data.objects.remove(o, do_unlink=True)
    sc = bpy.context.scene; sc.render.fps = FPS; vl = bpy.context.view_layer
    for pb in arm.pose.bones: pb.rotation_mode = "QUATERNION"
    REST = {b.name: b.matrix_local.copy() for b in arm.data.bones}
    hp_ = HEADS.get("p", [REST["Head"].translation]); HC0 = sum(hp_, Vector())/len(hp_); HR = sorted((p - HC0).length for p in hp_)[int(len(hp_)*.9)]   # centro e raio da cabeça no repouso
    HC_LOCAL = REST["Head"].inverted() @ HC0
    up_ = [p - HC0 for p in hp_ if p.z > HC0.z]; HAX = Vector((max(abs(d.x) for d in up_), max(abs(d.y) for d in up_), max(d.z for d in up_)))   # semi-eixos do crânio (elipsoide)
    AN = REST["foot_r"].translation.z; LT = (REST["calf_r"].translation - REST["thigh_r"].translation).length; LS = (REST["foot_r"].translation - REST["calf_r"].translation).length
    HIP = {s: REST[f"thigh_{s}"].translation - REST["pelvis"].translation for s in "lr"}
    LU = (REST["lowerarm_r"].translation - REST["upperarm_r"].translation).length; LF = (REST["hand_r"].translation - REST["lowerarm_r"].translation).length
    def set_rot(name, R, loc=None):
        vl.update(); pb = arm.pose.bones[name]; M = (R @ REST[name].to_3x3()).to_4x4(); M.translation = loc if loc is not None else pb.head.copy(); pb.matrix = M
    PREV = {}
    def key(name, f, loc=False):
        pb = arm.pose.bones[name]; q = pb.rotation_quaternion
        if name in PREV and PREV[name].dot(q) < 0: pb.rotation_quaternion = -q
        PREV[name] = pb.rotation_quaternion.copy(); pb.keyframe_insert("rotation_quaternion", frame=f, group=name)
        if loc: pb.keyframe_insert("location", frame=f, group=name)
    def empty(n): e = bpy.data.objects.new(n, None); sc.collection.objects.link(e); e.rotation_mode = "QUATERNION"; return e
    IKT = {s: empty(f"IK_pe_{s}") for s in "lr"}; POLE = {s: empty(f"Polo_{s}") for s in "lr"}
    for s in "lr":
        c = arm.pose.bones[f"calf_{s}"].constraints.new("IK"); c.target = IKT[s]; c.pole_target = POLE[s]; c.chain_count = 2
        arm.pose.bones[f"foot_{s}"].constraints.new("COPY_ROTATION").target = IKT[s]
    best = None
    for a in (-180, -90, 0, 90):
        for s in "lr":
            arm.pose.bones[f"calf_{s}"].constraints[0].pole_angle = D(a)
            IKT[s].matrix_world = Matrix.Translation(REST[f"foot_{s}"].translation + Vector((0, 0, .06))) @ REST[f"foot_{s}"].to_3x3().to_4x4()
            POLE[s].location = REST[f"calf_{s}"].translation + Vector((0, -.6, 0))
        vl.update(); err = sum((arm.pose.bones[f"calf_{s}"].head - REST[f"calf_{s}"].translation).length for s in "lr")
        if best is None or err < best[1]: best = (a, err)
    for s in "lr": arm.pose.bones[f"calf_{s}"].constraints[0].pole_angle = D(best[0])
    foot_m = lambda s, yaw, pitch: rot(yaw, pitch) @ REST[f"foot_{s}"].to_3x3()
    toe_off = lambda s: REST[f"ball_{s}"].translation - REST[f"foot_{s}"].translation
    def ankle_at(s, pos, yaw, pitch):
        flat = Vector((pos.x, pos.y, AN)); bj = flat + rot(yaw) @ toe_off(s); return bj - rot(yaw, pitch) @ toe_off(s)
    T, N = plan["T"], round(plan["T"]*FPS); STEPS = plan["steps"]
    def yw_prev(s, t):
        yw = plan["init"][s][1]
        for e in STEPS[s]:
            if e[1] <= t: yw = e[4]
        return yw
    def arc(d): h1 = .10 + .13*min(1, d/.7); return h1, min(1, h1/.30)**1.5
    def foot_state(s, tc):                                           # (tornozelo, pitch, yaw, no chão)
        for (t_off, t_on, P0_, P1_, yw) in STEPS[s]:
            if t_off <= tc <= t_on:
                u = (tc - t_off)/(t_on - t_off); h1, kp = arc((P1_ - P0_).length)
                path = pchip({0: tuple(ankle_at(s, P0_, yw_prev(s, t_off), 30*kp)), .38: tuple(P0_.lerp(P1_, .25) + Vector((0, 0, h1))),
                              .75: tuple(P0_.lerp(P1_, .80) + Vector((0, 0, .6*h1))), 1: tuple(P1_ + Vector((0, 0, AN + .015)))})
                y0 = yw_prev(s, t_off); uu = min(1, u/.6); ys = y0 + (yw - y0)*uu*uu*(3 - 2*uu)
                return Vector(path(u)), pchip({0: 30*kp, .38: 45*kp, .75: -4*kp, 1: -8*kp})(u), ys, False
        pos, yw, t_on_last, t_next = plan["init"][s][0], plan["init"][s][1], -9, 9
        for e in STEPS[s]:
            if tc >= e[1]: pos, yw, t_on_last = e[3], e[4], e[1]
            if e[0] > tc: t_next = min(t_next, e[0])
        k_on = min(1, (tc - t_on_last)/.06) if t_on_last > -9 else 1
        nxt = next((e for e in STEPS[s] if e[0] == t_next), None); kp_n = arc((nxt[3] - nxt[2]).length)[1] if nxt else 1
        k_off = max(0, 1 - (t_next - tc)/.08) if t_next < 9 else 0
        pitch = -8*(1 - k_on) + 30*kp_n*k_off**2
        an = ankle_at(s, pos, yw, pitch) if pitch > 0 else Vector((pos.x, pos.y, AN + .015*(1 - k_on)))
        return an, pitch, yw, True
    P_POS, P_ROT, C_ROT, HEAD = pchip(plan["pel"]), pchip(plan["prot"]), pchip(plan["crot"]), pchip(plan["head"])
    def densa(tab):                                                  # chaves extras no ARCO (ponto médio esférico) até ≤ 25° entre chaves: a direção gira com velocidade
        ks = sorted(tab); out = {}                                   # angular uniforme (interpolar componentes encurtava o vetor no meio e a mão "estalava")
        def ins(t0, a0, t1, a1, n=0):
            ang = max(Vector(a0[i]).angle(Vector(a1[i]), 0) for i in (0, 1))
            if ang <= D(25) or n > 4 or any((Vector(a0[i]).normalized() + Vector(a1[i]).normalized()).length < 1e-3 for i in (0, 1)): return
            tm = (t0 + t1)/2; am = tuple(tuple((Vector(a0[i]).normalized() + Vector(a1[i]).normalized()).normalized()) for i in (0, 1)); out[tm] = am
            ins(t0, a0, tm, am, n + 1); ins(tm, am, t1, a1, n + 1)
        for t0, t1 in zip(ks, ks[1:]): ins(t0, tab[t0], t1, tab[t1])
        out.update({t: (tuple(Vector(v[0]).normalized()), tuple(Vector(v[1]).normalized())) for t, v in tab.items()}); return out
    ARMF = {s: pchip({t: tuple(v[0]) + tuple(v[1]) for t, v in densa(tab).items()}) for s, tab in plan["arms"].items()}
    IKW = {s: pchip({t: (w,) for t, (_, w) in plan["ik"][s].items()}) for s in plan["ik"]}
    IKK = {s: plan["ik"][s][min(plan["ik"][s])][0] for s in plan["ik"]}
    def mao(s, tc):                                                  # (pose dos dedos, intensidade) — mistura entre chaves vizinhas
        tab = plan["maos"].get(s, {0: ("relaxada", 1)}); ks = sorted(tab)
        if tc <= ks[0]: return tab[ks[0]]
        for a_, b_ in zip(ks, ks[1:]):
            if a_ <= tc <= b_:
                (pa, ka), (pb, kb) = tab[a_], tab[b_]; u = (tc - a_)/(b_ - a_); u = u*u*(3 - 2*u)
                if pa == pb: return pa, ka + (kb - ka)*u
                return (pb, kb*u) if pa == "relaxada" else (pa, ka*(1 - u)) if pb == "relaxada" else (pb if u > .5 else pa, 1)
        return tab[ks[-1]]
    # alcance da perna de apoio
    LMAX = LT + LS - .008; DZ = [0.0]*(N + 1)
    def hip_pos(s, tc): (x, y, z), (yw, ln, tl) = P_POS(tc), P_ROT(tc); return Vector((x, y, z)) + rot(yw, ln, tl) @ HIP[s]
    for f in range(N + 1):
        tc = f/FPS
        for s in "lr":
            an, _, _, g = foot_state(s, tc)
            if g: h = hip_pos(s, tc); dxy = (h - an).xy.length; DZ[f] = min(DZ[f], an.z + math.sqrt(max(0, LMAX*LMAX - dxy*dxy)) - h.z)
    for _ in range(2):
        DZ = [min(DZ[max(0, i - 4):i + 5]) for i in range(N + 1)]; DZ = [sum(DZ[max(0, i - 4):i + 5])/len(DZ[max(0, i - 4):i + 5]) for i in range(N + 1)]
    def arm_ik(Sv, Wv, pole):
        d = Wv - Sv; L_ = min(d.length, LU + LF - 1e-3); n = d.normalized(); a_ = (LU*LU - LF*LF + L_*L_)/(2*L_); h_ = math.sqrt(max(0, LU*LU - a_*a_))
        p_ = pole - Sv; p_ = (p_ - n*p_.dot(n)).normalized(); E_ = Sv + n*a_ + p_*h_; return E_, Sv + n*L_
    def alvo(kind, s, P, Rp, Rc, Sv, HC, Rh):
        """punho, polo do cotovelo e direção dos dedos para cada gesto de contato (alvos afastados da cabeça/tronco para não atravessar a geometria)"""
        sg = 1 if s == "l" else -1
        if kind == "cintura": return P + Rp @ Vector((sg*.20, -.01, .14)), P + Rp @ Vector((sg*.8, .25, .30)), Rp @ Vector((-sg*.25, -.85, -.45))   # punho ao lado da cintura (meia-largura 0,16 m); dedos à frente e para baixo, contornando o quadril
        if kind == "peito":   return P + Rc @ Vector((-sg*.02, -.20, .40)), Sv + Rc @ Vector((sg*.5, -.2, -.6)), Rc @ Vector((-sg*.8, -.2, .3))
        if kind == "rosto":   return HC + Rh @ Vector((sg*.03, -(HAX.y*.75 + .04), -.11)), Sv + Rc @ Vector((sg*.12, -.55, -.6)), Rh @ Vector((-sg*.2, -.2, .95))   # acompanha a cabeça
        return HC + Rh @ Vector((sg*(HAX.x + .055), .04, .02)), Sv + Rc @ Vector((sg*.9, -.1, .45)), Rh @ Vector((-sg*.58, .15, .80))   # cabeca: palmas nas laterais, dedos sobre o topo
    FWD = BR.FWD0
    MARGEM, PUSH = BR.MARGEM, {"l": 0.0, "r": 0.0}
    sc.frame_start, sc.frame_end = 0, N
    PUSHF = {s: [Vector()]*(N + 1) for s in "lr"}
    for passo in (1, 2):                                             # 1º passe mede o empurrão anticolisão por quadro; ele é suavizado no tempo e o 2º passe é o definitivo
      TOES = []
      for f in range(N + 1):
          tc = f/FPS; sc.frame_set(f)
          (x, y, z), (yw, ln, tl), ch, (hp, hy) = P_POS(tc), P_ROT(tc), C_ROT(tc), HEAD(tc); z += DZ[f]
          Rp, Rc = rot(yw, ln, tl), rot(*ch); P = Vector((x, y, z))
          set_rot("pelvis", Rp, P); key("pelvis", f, loc=True)
          qp, qc = Rp.to_quaternion(), Rc.to_quaternion()
          for i, b in enumerate(("spine_01", "spine_02", "spine_03")): set_rot(b, qp.slerp(qc, (i + 1)/3).to_matrix()); key(b, f)
          Rh = Matrix.Rotation(D(hy), 3, "Z") @ Rc @ Matrix.Rotation(D(hp), 3, "X")
          set_rot("neck_01", qc.slerp(Rh.to_quaternion(), .5).to_matrix()); key("neck_01", f); set_rot("Head", Rh); key("Head", f)
          vl.update(); HC = arm.pose.bones["Head"].matrix @ HC_LOCAL
          def pose_braco(s, push):                                      # braço, mão e dedos de um lado; push = deslocamento do alvo do punho (colisão)
              v = ARMF[s](tc); ua, fa = Rc @ Vector(v[:3]), Rc @ Vector(v[3:]); w = IKW[s](tc)[0] if s in IKW else 0; hd = None
              if w > 1e-3:                                             # gesto de contato: IK analítico até o alvo, misturado com o braço livre
                  vl.update(); Sv = arm.pose.bones[f"upperarm_{s}"].head.copy(); W_, pole, hd = alvo(IKK[s], s, P, Rp, Rc, Sv, HC, Rh)
                  E_, W2 = arm_ik(Sv, W_, pole); ua = ua.normalized().lerp((E_ - Sv).normalized(), w); fa = fa.normalized().lerp((W2 - E_).normalized(), w)
                  hd = (fa.normalized().lerp(hd.normalized(), w)) if hd is not None else None
              if push.length > 1e-6:                                   # encostando no corpo: o punho final (gesto + braço livre já misturados) é empurrado para fora (cotovelo no mesmo plano)
                  vl.update(); Sv = arm.pose.bones[f"upperarm_{s}"].head.copy(); E0 = Sv + ua.normalized()*LU; W0 = E0 + fa.normalized()*LF
                  E_, W2 = arm_ik(Sv, W0 + push, E0 + (E0 - (Sv + W0)/2)*2); ua, fa = E_ - Sv, W2 - E_
              Ru, Rf = BR.arm_world(REST, s, ua, fa, Rc @ FWD)
              set_rot(f"upperarm_{s}", Ru); set_rot(f"lowerarm_{s}", Rf); set_rot(f"hand_{s}", BR.hand_world(REST, s, Rf, hd))
              pose_, k_ = mao(s, tc)                                   # dedos (bracos.py): pose do gesto misturada com a mão relaxada
              for nm, q in BR.finger_quats(REST, s, pose_, k_).items(): arm.pose.bones[nm].rotation_quaternion = q
              return w
          for s in "lr":
              push = PUSHF[s][f].copy()
              for it in range(8):                                      # NENHUM dedo dentro do corpo: empurra o alvo do punho para fora pela normal da pele e resolve de novo
                  w = pose_braco(s, push); vl.update()
                  d_, n_, ob_ = BR.colisao_mao(arm, CORPO, s)
                  if os.environ.get("DBG_COL") and f == int(os.environ["DBG_COL"]): print("DBGCOL", s, it, round(d_*1000, 1), ob_, tuple(round(c, 2) for c in n_), round(push.length*100, 1), round(w, 2))
                  if d_ >= MARGEM: break
                  push += n_*(MARGEM - d_ + .003)
                  if push.length > .15: push *= .15/push.length
              PUSHF[s][f] = push; PUSH[s] = max(PUSH[s], push.length)
              for b in (f"upperarm_{s}", f"lowerarm_{s}", f"hand_{s}") + tuple(BR.finger_quats(REST, s)): key(b, f)
          for s in "lr":
              an, pitch, fy, _ = foot_state(s, tc); hp_ = hip_pos(s, tc)
              IKT[s].matrix_world = Matrix.Translation(an) @ foot_m(s, fy, pitch).to_4x4(); IKT[s].keyframe_insert("location", frame=f); IKT[s].keyframe_insert("rotation_quaternion", frame=f)
              POLE[s].location = hp_ + rot(fy) @ Vector((0, -.8, -.4)); POLE[s].keyframe_insert("location", frame=f)
          TOES.append((f, tc, {s: foot_state(s, tc) for s in "lr"}))
      if passo == 1:                                                 # suaviza o empurrão no tempo (média móvel de ±5 quadros: entra e sai sem tranco); o 2º passe corrige o resto
        for s in "lr":
            P_ = PUSHF[s]; PUSHF[s] = [sum(P_[max(0, i - 5):i + 6], Vector())/len(P_[max(0, i - 5):i + 6]) for i in range(N + 1)]
    for f, tc, st in TOES:                                           # 2º passe: dedos do pé chapados no apoio
        sc.frame_set(f); vl.update()
        for s in "lr":
            an, pitch, fy, ground = st[s]; pb = arm.pose.bones[f"ball_{s}"]; pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
            if ground and pitch > 0: set_rot(f"ball_{s}", rot(fy))
            key(f"ball_{s}", f)
    act = arm.animation_data.action; act.name = plan["nome"]; act.use_fake_user = True
    sys.path.insert(0, os.path.join(SKILLS, "blender-animation", "scripts")); import bake_action
    bake_action.run(source=arm.name, target=arm.name, actions=[plan["nome"]], clean=False)
    for o in [o for o in bpy.data.objects if o != arm]: bpy.data.objects.remove(o, do_unlink=True)
    for pb in arm.pose.bones:
        for c in list(pb.constraints): pb.constraints.remove(c)
    def frames():
        out = []
        for f in range(N + 1): sc.frame_set(f); vl.update(); out.append({b.name: b.matrix.copy() for b in arm.pose.bones})
        return out
    if mirror:                                                       # canhoto: espelho exato osso a osso (igual a cobranca.py / repouso.py)
        S_ = Matrix.Diagonal((-1, 1, 1, 1)); pbs = list(arm.pose.bones)
        twin = lambda n_: n_[:-2] + ("_r" if n_.endswith("_l") else "_l") if n_[-2:] in ("_l", "_r") else n_
        RM = {b.name: b.bone.matrix_local.copy() for b in pbs}; par = {b.name: (b.parent.name if b.parent else None) for b in pbs}; prevq = {}
        for f, Ms in enumerate(frames()):
            new = {nm: (S_ @ (Ms[twin(nm)] @ RM[twin(nm)].inverted()) @ S_) @ RM[nm] for nm in Ms}
            for b in pbs:
                nm = b.name; p = par[nm]; local = (new[p].inverted() @ new[nm]) if p else new[nm]; restrel = (RM[p].inverted() @ RM[nm]) if p else RM[nm]
                loc, q, _ = (restrel.inverted() @ local).decompose()
                if nm in prevq and prevq[nm].dot(q) < 0: q = -q
                prevq[nm] = q; b.location = loc; b.rotation_quaternion = q
                b.keyframe_insert("location", frame=f, group=nm); b.keyframe_insert("rotation_quaternion", frame=f, group=nm)
    # ---- verificação ----
    fr = frames()
    def apoio_deriva(s):
        worst = 0; ons = [(-9, None)] + [(e[1], e) for e in STEPS[s]]; sname = s if not mirror else ("l" if s == "r" else "r")
        for t_on, _ in ons:
            offs = [e[0] for e in STEPS[s] if e[0] > t_on]; a_ = math.ceil(max(0, t_on + .06)*FPS); b_ = math.floor((min(offs) if offs else T)*FPS)
            if b_ > a_: worst = max(worst, max((fr[i][f"ball_{sname}"].translation - fr[a_][f"ball_{sname}"].translation).xy.length for i in range(a_, b_ + 1)))
        return round(worst*1000, 1)
    low = min(min(m["ball_l"].translation.z, m["ball_r"].translation.z, (m["ball_l"] @ Vector((0, arm.data.bones["ball_l"].length, 0))).z, (m["ball_r"] @ Vector((0, arm.data.bones["ball_r"].length, 0))).z) for m in fr)
    # mãos x corpo: menor distância (com sinal) das juntas e pontas dos dedos à pele (cabeça, pescoço, tronco, quadril, coxas); negativa = atravessou
    hd_min, hd_onde = min(((lambda r: (r[0], f"mão {s}→{r[2]}@{i/FPS:.2f}s"))(BR.colisao_mao(arm, CORPO, s, m)) for i, m in enumerate(fr) for s in "lr"), key=lambda r: r[0])
    pv = [(fr[i]["pelvis"].translation - fr[i - 1]["pelvis"].translation).length*FPS for i in range(1, N + 1)]
    rep = {"clipe": out_name, "duracao_s": T, "deriva_apoio_mm": {s: apoio_deriva(s) for s in "lr"}, "pe_mais_baixo_z_m": round(low, 3), "pelve_abaixada_cm": round(-min(DZ)*100, 1),
           "vel_pelve_max_m_s": round(max(pv), 2), "vel_pelve_fim_m_s": round(pv[-1], 3), "pelve_fim": [round(c, 3) for c in fr[N]["pelvis"].translation],
           "torcao_max_graus": BR.max_twist(arm, REST, range(0, N + 1, 2), sc, vl), "dedos_pele_min_mm": round(hd_min*1000, 1), "colisao_empurrao_max_cm": {k: round(v*100, 1) for k, v in PUSH.items()}, "dedos_pele_onde": hd_onde, "cranio_semi_eixos_m": [round(c, 3) for c in HAX]}
    zs = [m["pelvis"].translation.z for m in fr]; rep["subida_pelve_m"] = round(max(zs) - zs[0], 3)
    arm["clipe_reacao"] = plan["nome"]; arm["clipe_duracao_s"] = T; arm["clipe_pe"] = "l" if mirror else "r"
    sc.frame_set(0)
    for o in bpy.data.objects: o.select_set(o == arm)
    vl.objects.active = arm
    os.makedirs(os.path.abspath(OUT_DIR), exist_ok=True); out = os.path.join(os.path.abspath(OUT_DIR), out_name)
    r = bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_animations=True, export_animation_mode="ACTIONS",
                                  export_force_sampling=True, export_extras=True, export_skins=False, export_morph=False, export_materials="NONE")
    rep["export"] = list(r); rep["bytes"] = os.path.getsize(out)
    return rep

QUAIS = args[3].split(",") if len(args) > 3 and args[3] else list(PLANOS)
report = []
for nome in QUAIS:
    plan = PLANOS[nome]()
    for side in ("r", "l"): report.append(build(plan, f"{nome}_{side}.glb", side == "l"))
print("@@JSON@@" + json.dumps(report, ensure_ascii=False))
