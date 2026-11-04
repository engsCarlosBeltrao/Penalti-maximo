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

def plano(nome, T, steps, pel, prot, crot, head, arms, ik=None, maos=None, init=None, ombros=None, rigidez=1.0):
    return dict(nome=nome, T=T, steps=steps, init=init or {"r": (END_R, 0), "l": (END_L, 0)}, pel=pel, prot=prot, crot=crot, head=head, arms=arms,
                ik=ik or {}, maos=maos or {"l": {0: ("relaxada", 1)}, "r": {0: ("relaxada", 1)}}, ombros=ombros or {0: (0, 0)}, rigidez=rigidez)

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

# ======================= 5 COMEMORAÇÕES (com energia: percebe → explode → gesto → corre/salta → continua vibrando → desacelera → estável) =======================
UPF = lambda s: ((s*.48, -.18, -.86), (s*.18, -.30, .94))            # punho cerrado na altura do ombro, antebraço em pé (cotovelo ~95°)
DNF = lambda s: ((s*.32, .14, -.94), (s*.22, -.62, .75))             # "puxada": cotovelo para trás com força, punho junto ao peito
OVH = lambda s, x=.25: ((s*x, -.12, .96), (s*x*.6, -.16, .98))       # braço esticado acima da cabeça
ASA = lambda s, up: ((s*.95, -.08, up), (s*.92, -.22, up + .12))     # braço aberto como asa
CRO = lambda s: ((s*.18, .45, -.88), (s*.10, .25, -.96))             # braços jogados para trás (preparação de salto / explosão)

def corrida(Y, ds, tts, feet, hh=None):
    """Passadas num caminho girado Y graus: ds = distância de cada apoio, tts = (sai, pousa); pelve baixa no apoio, alta no voo; braços opostos às pernas."""
    A, sd, c = caminho(Y); steps = {"r": [], "l": []}; prev = {"r": END_R, "l": END_L}; pel = {}; arms = {"l": {}, "r": {}}
    tts = [(min(a, tts[i - 2][1] + .12) if i >= 2 else a, b) for i, (a, b) in enumerate(tts)]   # apoio de ~0,12 s e fase de VOO (o pé sai antes do outro pousar)
    for i, (f, (a, b)) in enumerate(zip(feet, tts)):
        p = sd(ds[i], -1 if f == "r" else 1); steps[f].append((a, b, prev[f], p, Y if i else Y/2) + ((hh,) if hh else ())); prev[f] = p
        pel[b] = c(ds[i] - .12, .90); pel[b + .06] = c(ds[i] - .02, .885)                    # pousa um pouco à frente da pelve, amortece sobre o pé
        if i: pel[(tts[i - 1][1] + b)/2 + .02] = c(ds[i - 1] + (ds[i] - ds[i - 1])*.5, .94)    # voo
        fl, bl = ("l", "r") if f == "r" else ("r", "l"); arms[fl][b] = RFWD(1 if fl == "l" else -1); arms[bl][b] = RBCK(1 if bl == "l" else -1)
    return steps, pel, arms, (A, sd, c)

def gol_bracos_abertos():
    """Explode (agacha e puxa os braços), sai correndo em curva com os braços abertos como asas, inclinando o corpo de um lado para o outro e gritando;
    desacelera, fecha os braços em dois socos no ar e termina parado, ofegante."""
    Y = 40; ds = [.55, 1.20, 1.88, 2.56, 3.18, 3.62, 3.80]; tts = [(.24, .46), (.46, .70), (.70, .94), (.94, 1.18), (1.18, 1.44), (1.50, 1.80), (1.88, 2.16)]
    steps, pel, _, (A, sd, c) = corrida(Y, ds, tts, ["r", "l", "r", "l", "r", "l", "r"])
    pel.update({0: (0, 0, .93), .16: (0, .02, .86), 2.3: c(3.74, .90), 2.55: c(3.75, .92), 2.75: c(3.75, .895), 3.0: c(3.76, .92), 3.6: c(3.76, .926)})
    prot = {0: (0, 6, 0), .16: (0, 18, 0), .46: (Y/2, 12, 0), .94: (Y, 10, 6), 1.44: (Y + 6, 8, -6), 1.8: (Y + 10, 6, 0), 2.3: (Y + 10, 8, 0), 3.6: (Y + 10, 3, 0)}
    crot = {0: (0, 10, 0), .16: (0, 30, 0), .4: (Y/2, 8, 0), .85: (Y, 2, -16), 1.10: (Y + 4, 0, 16), 1.35: (Y + 8, 0, -16), 1.6: (Y + 10, 2, 14), 1.85: (Y + 10, 3, -8), 2.06: (Y + 10, 4, 0),
            2.35: (Y + 10, 18, 0), 2.55: (Y + 10, -2, 0), 2.75: (Y + 10, 16, 0), 3.0: (Y + 10, 0, 0), 3.3: (Y + 10, 8, 0), 3.6: (Y + 10, 5, 0)}
    head = {0: (20, 0), .16: (24, 0), .4: (-12, 0), .9: (-20, 8), 1.4: (-18, -8), 1.9: (-10, 0), 2.35: (10, 0), 2.55: (-22, 0), 2.75: (6, 0), 3.0: (-16, 0), 3.6: (10, 0)}
    AS2 = lambda g, up: ((g*.88, -.30, up), (g*.80, -.48, up + .22))  # asa: braço aberto um pouco à frente, cotovelo solto, mão acima do cotovelo
    arms = {s: {0: HANG(g), .16: CRO(g), .4: ((g*.7, -.3, -.4), (g*.75, -.4, -.2)), 2.3: UPF(g), 2.5: OVH(g), 2.7: UPF(g), 2.9: OVH(g, .3),
                3.25: ((g*.35, -.1, -.85), (g*.25, -.4, -.85)), 3.6: HANG(g)} for s, g in (("l", 1), ("r", -1))}
    for t_, up_l, up_r in ((.62, .05, .05), (.85, .42, -.18), (1.10, -.16, .40), (1.35, .40, -.14), (1.60, -.12, .42), (1.85, .30, -.02), (2.06, .14, .14)):
        arms["l"][t_] = AS2(1, up_l); arms["r"][t_] = AS2(-1, up_r)  # as asas "batem": um lado sobe enquanto o outro desce, a cada passada, e o tronco inclina junto
    maos = {s: {0: ("relaxada", 1), .12: ("punho", 1), .4: ("aberta", .8), 2.05: ("aberta", .8), 2.25: ("punho", 1), 3.0: ("punho", 1), 3.35: ("relaxada", 1)} for s in "lr"}
    return plano("GolBracosAbertos", 3.6, steps, pel, prot, crot, head, arms, maos=maos)

def gol_punhos():
    """VAMOS: agacha de repente e avança um passo puxando os dois punhos com força e gritando; três socos alternados no ar com os joelhos quicando;
    pulinho com os dois punhos acima da cabeça; vira em dois passos ainda vibrando e se acalma."""
    Y = 25; A, sd, c = caminho(Y)
    R1, L0 = END_R + V(.02, -.32), END_L
    steps = {"r": [(.16, .40, END_R, R1, 4), (1.38, 1.62, R1, R1 + V(0, .02), 4, .12), (2.05, 2.35, R1 + V(0, .02), sd(.55, -1), Y)],
             "l": [(1.38, 1.62, L0, L0 + V(0, .02), 0, .12), (2.35, 2.65, L0 + V(0, .02), sd(.62, 1), Y)]}
    pel = {0: (0, 0, .93), .14: (0, .01, .855), .40: (0, -.12, .87), .55: (0, -.14, .895), .75: (0, -.14, .865), .95: (0, -.14, .895), 1.15: (0, -.14, .865), 1.32: (0, -.14, .86),
           1.5: (0, -.14, 1.02), 1.66: (0, -.14, .87), 1.85: (0, -.14, .91), 2.35: c(.42, .905), 2.65: c(.55, .92), 3.4: c(.58, .926)}
    prot = {0: (0, 6, 0), .14: (0, 16, 0), .4: (2, 20, 0), .75: (-6, 12, 0), 1.15: (6, 12, 0), 1.32: (0, 14, 0), 1.5: (0, 0, 0), 1.66: (0, 12, 0), 2.35: (Y - 6, 8, 0), 2.65: (Y, 5, 0), 3.4: (Y, 3, 0)}
    crot = {0: (0, 10, 0), .14: (0, 30, 0), .4: (0, 34, 0), .55: (-10, 10, 4), .75: (10, 22, -4), .95: (-10, 10, 4), 1.15: (10, 22, -4), 1.32: (0, 20, 0), 1.5: (0, -8, 0),
            1.66: (0, 16, 0), 1.9: (4, 4, 0), 2.35: (Y - 4, 10, 0), 2.6: (Y, 2, 0), 3.0: (Y, 8, 0), 3.4: (Y, 5, 0)}
    head = {0: (20, 0), .14: (26, 0), .4: (-4, 0), .55: (-18, 6), .75: (-8, -6), .95: (-18, 6), 1.15: (-8, -6), 1.5: (-26, 0), 1.7: (-6, 0), 2.3: (-12, 10), 2.8: (4, 0), 3.4: (12, 0)}
    SOC = lambda g: ((g*.32, -.28, .9), (g*.2, -.3, .93))            # soco para o alto (braço quase esticado acima da cabeça)
    arms = {s: {0: HANG(g), .14: CRO(g), .40: DNF(g), .55: SOC(g), .75: DNF(g), .95: SOC(g), 1.15: DNF(g), 1.32: DNF(g), 1.5: OVH(g, .3), 1.66: UPF(g), 1.85: DNF(g), 2.1: UPF(g),
                2.45: ((g*.45, -.1, -.6), (g*.3, -.5, -.4)), 2.9: ((g*.25, -.05, -.95), (g*.15, -.35, -.9)), 3.4: HANG(g)} for s, g in (("l", 1), ("r", -1))}
    arms["r"].update({.55: DNF(-1), .75: SOC(-1), .95: DNF(-1), 1.15: SOC(-1)})   # socos ALTERNADOS: um sobe enquanto o outro puxa
    maos = {s: {0: ("relaxada", 1), .1: ("punho", 1), 2.4: ("punho", 1), 2.9: ("relaxada", 1)} for s in "lr"}
    return plano("GolPunhos", 3.4, steps, pel, prot, crot, head, arms, maos=maos, rigidez=1.6)

def gol_salto():
    """Percebe o gol e explode em dois passos rápidos, salta com os dois pés socando o ar com o punho direito (o outro braço aberto), aterrissa
    amortecendo, dá um segundo pulinho com os dois punhos para cima, grita com os punhos cerrados e caminha se acalmando."""
    Y = 15; A, sd, c = caminho(Y)
    steps = {"r": [(.22, .44, END_R, sd(.42, -1), Y), (.94, 1.36, sd(.42, -1), sd(1.02, -1), Y, .22), (1.60, 1.92, sd(1.02, -1), sd(1.10, -1), Y, .12), (2.55, 2.85, sd(1.10, -1), sd(1.50, -1), Y)],
             "l": [(.42, .66, END_L, sd(.82, 1), Y), (.94, 1.36, sd(.82, 1), sd(1.10, 1), Y, .22), (1.60, 1.92, sd(1.10, 1), sd(1.18, 1), Y, .12), (2.85, 3.15, sd(1.18, 1), sd(1.60, 1, -.02), Y)]}
    pel = {0: (0, 0, .93), .16: (0, .01, .87), .44: c(.30, .90), .66: c(.62, .89), .86: c(.80, .83), 1.15: c(.98, 1.16), 1.36: c(1.04, .86), 1.48: c(1.05, .84), 1.60: c(1.06, .87),
           1.76: c(1.09, 1.03), 1.92: c(1.12, .87), 2.1: c(1.13, .90), 2.4: c(1.14, .92), 2.85: c(1.38, .91), 3.15: c(1.52, .925), 3.3: c(1.535, .926), 3.6: c(1.54, .926)}
    prot = {0: (0, 6, 0), .16: (0, 16, 0), .44: (Y - 4, 10, -2), .66: (Y + 4, 12, 2), .86: (Y, 22, 0), 1.15: (Y, -6, 0), 1.36: (Y, 18, 0), 1.6: (Y, 10, 0), 1.76: (Y, -4, 0),
            1.92: (Y, 14, 0), 2.3: (Y, 6, 0), 3.6: (Y, 3, 0)}
    crot = {0: (0, 10, 0), .16: (0, 28, 0), .44: (Y + 6, 12, 2), .66: (Y - 6, 12, -2), .86: (Y, 30, 0), 1.15: (Y + 8, -14, -6), 1.36: (Y, 18, 0), 1.6: (Y, 10, 0),
            1.76: (Y, -12, 0), 1.92: (Y, 16, 0), 2.15: (Y, 4, 0), 2.35: (Y, 18, 0), 2.6: (Y, 4, 0), 3.0: (Y, 6, 0), 3.6: (Y, 5, 0)}
    head = {0: (20, 0), .16: (26, 0), .44: (4, 0), .86: (14, 0), 1.15: (-28, 0), 1.4: (-6, 0), 1.76: (-26, 0), 1.95: (-4, 0), 2.35: (-20, 0), 2.7: (2, 0), 3.6: (12, 0)}
    arms = {"l": {0: HANG(1), .16: CRO(1), .44: RFWD(1), .66: RBCK(1), .86: CRO(1), 1.04: ((.55, -.6, -.3), (.6, -.6, .1)), 1.18: ASA(1, .3), 1.36: ASA(1, .1),
                  1.5: DNF(1), 1.76: OVH(1, .3), 1.95: UPF(1), 2.15: DNF(1), 2.35: UPF(1), 2.6: DNF(1), 3.0: ((.3, -.05, -.92), (.2, -.4, -.88)), 3.4: HANG(1), 3.6: HANG(1)},
            "r": {0: HANG(-1), .16: CRO(-1), .44: RBCK(-1), .66: RFWD(-1), .86: CRO(-1), 1.04: ((-.3, -.8, -.4), (-.25, -.95, .1)), 1.18: OVH(-1, .12), 1.36: OVH(-1, .2),
                  1.5: DNF(-1), 1.76: OVH(-1, .3), 1.95: UPF(-1), 2.15: DNF(-1), 2.35: UPF(-1), 2.6: DNF(-1), 3.0: ((-.3, -.05, -.92), (-.2, -.4, -.88)), 3.4: HANG(-1), 3.6: HANG(-1)}}
    maos = {"l": {0: ("relaxada", 1), .12: ("punho", 1), 1.04: ("aberta", .7), 1.36: ("aberta", .7), 1.48: ("punho", 1), 2.75: ("punho", 1), 3.1: ("relaxada", 1)},
            "r": {0: ("relaxada", 1), .12: ("punho", 1), 2.75: ("punho", 1), 3.1: ("relaxada", 1)}}
    return plano("GolSalto", 3.6, steps, pel, prot, crot, head, arms, maos=maos)

def gol_aponta():
    """Explode cerrando os punhos e gritando, corre quatro passadas para a torcida vibrando os punhos, freia com os dois indicadores apontando para o
    céu (olhando para cima), alterna os braços apontando, leva a mão direita ao peito com o indicador esquerdo ainda no alto e se acalma."""
    Y = -25; ds = [.50, 1.12, 1.76, 2.30, 2.58]; tts = [(.22, .44), (.44, .68), (.68, .92), (.92, 1.20), (1.26, 1.56)]
    steps, pel, _, (A, sd, c) = corrida(Y, ds, tts, ["l", "r", "l", "r", "l"])
    steps["r"].append((2.45, 2.75, steps["r"][-1][3], sd(2.70, -1), Y)); steps["l"].append((2.75, 3.05, steps["l"][-1][3], sd(2.80, 1, -.04), Y))
    pel.update({0: (0, 0, .93), .14: (0, .01, .86), 1.7: c(2.55, .905), 2.0: c(2.56, .92), 2.3: c(2.57, .905), 2.75: c(2.68, .915), 3.05: c(2.76, .924), 3.6: c(2.77, .926)})
    prot = {0: (0, 6, 0), .14: (0, 18, 0), .44: (Y/2, 12, 0), .92: (Y, 12, 0), 1.56: (Y, 4, 0), 2.3: (Y, 3, 0), 3.6: (Y, 3, 0)}
    crot = {0: (0, 10, 0), .14: (0, 30, 0), .44: (Y/2 + 5, 14, 0), .68: (Y - 6, 14, 0), .92: (Y + 6, 14, 0), 1.2: (Y - 4, 10, 0), 1.6: (Y, -10, 0), 1.95: (Y + 8, -8, 3),
            2.25: (Y - 8, -8, -3), 2.6: (Y, -4, 0), 3.1: (Y, 4, 0), 3.6: (Y, 5, 0)}
    head = {0: (20, 0), .14: (26, 0), .4: (-14, 0), 1.2: (-6, 0), 1.6: (-34, 0), 1.95: (-30, 8), 2.25: (-30, -8), 2.6: (-24, 0), 3.1: (0, 0), 3.6: (12, 0)}
    arms = {s: {0: HANG(g), .14: CRO(g), .32: UPF(g), .44: DNF(g), .68: UPF(g), .92: DNF(g), 1.2: UPF(g), 1.5: OVH(g, .22), 1.95: OVH(g, .12), 2.25: OVH(g, .3)}
            for s, g in (("l", 1), ("r", -1))}
    arms["r"].update({1.95: OVH(-1, .32), 2.25: OVH(-1, .1), 2.6: ((-.3, -.3, -.6), (-.2, -.6, .3)), 3.0: ((-.25, -.2, -.9), (-.15, -.5, -.8)), 3.6: HANG(-1)})
    arms["l"].update({2.6: OVH(1, .2), 3.0: OVH(1, .25), 3.3: ((.4, -.1, -.6), (.3, -.4, -.5)), 3.6: HANG(1)})
    ik = {"r": {0: ("peito", 0), 2.35: ("peito", 0), 2.7: ("peito", 1), 3.05: ("peito", 1), 3.4: ("peito", 0), 3.6: ("peito", 0)}}
    maos = {"r": {0: ("relaxada", 1), .1: ("punho", 1), 1.25: ("punho", 1), 1.45: ("aponta", 1), 2.4: ("aponta", 1), 2.65: ("aberta", .6), 3.1: ("aberta", .6), 3.4: ("relaxada", 1)},
            "l": {0: ("relaxada", 1), .1: ("punho", 1), 1.25: ("punho", 1), 1.45: ("aponta", 1), 3.1: ("aponta", 1), 3.4: ("relaxada", 1)}}
    return plano("GolAponta", 3.6, steps, pel, prot, crot, head, arms, ik=ik, maos=maos)

def gol_corrida():
    """Arranca numa corrida de comemoração em arco (seis passadas, braços de velocista, gritando), freia com um pulo de chegada nos dois pés com os
    braços abertos para o alto, mostra os punhos cerrados à frente do peito (cotovelos abertos, "força!") e se acalma."""
    Y = 55; ds = [.55, 1.22, 1.92, 2.62, 3.28, 3.80]; tts = [(.16, .40), (.40, .64), (.64, .88), (.88, 1.12), (1.12, 1.38), (1.38, 1.66)]
    steps, pel, rarms, (A, sd, c) = corrida(Y, ds, tts, ["r", "l", "r", "l", "r", "l"])
    steps["r"].append((1.46, 2.14, steps["r"][-1][3], sd(4.30, -1.5), Y + 10, .14)); steps["l"].append((1.80, 2.14, steps["l"][-1][3], sd(4.32, 1.5), Y + 10, .14))
    steps["r"].append((3.0, 3.3, sd(4.30, -1.5), sd(4.36, -1), Y + 10))
    pel.update({0: (0, 0, .93), .12: (0, .01, .87), 1.76: c(3.95, .86), 1.97: c(4.15, 1.02), 2.14: c(4.30, .84), 2.3: c(4.31, .82), 2.6: c(4.31, .87), 2.85: c(4.31, .84),
                3.1: c(4.32, .90), 3.3: c(4.34, .92), 3.8: c(4.35, .926)})
    prot = {0: (0, 6, 0), .12: (0, 16, 0), .4: (Y/2, 14, 0), .88: (Y, 16, 0), 1.66: (Y + 6, 12, 0), 1.97: (Y + 10, -4, 0), 2.3: (Y + 10, 18, 0), 2.85: (Y + 10, 20, 0), 3.3: (Y + 10, 6, 0), 3.8: (Y + 10, 3, 0)}
    crot = {0: (0, 10, 0), .12: (0, 26, 0), .4: (Y/2 + 6, 16, 0), .64: (Y - 6, 18, 0), .88: (Y + 6, 18, 0), 1.12: (Y - 6, 18, 0), 1.38: (Y + 6, 16, 0), 1.66: (Y, 12, 0),
            1.97: (Y + 10, -16, 0), 2.3: (Y + 10, 8, 0), 2.6: (Y + 10, 22, 0), 2.85: (Y + 10, 26, 0), 3.1: (Y + 10, 6, 0), 3.4: (Y + 10, 10, 0), 3.8: (Y + 10, 5, 0)}
    head = {0: (20, 0), .12: (26, 0), .4: (-6, 0), .9: (-16, 0), 1.4: (-8, 0), 1.97: (-30, 0), 2.3: (-10, 0), 2.6: (-18, 0), 2.85: (-24, 0), 3.2: (0, 0), 3.8: (12, 0)}
    arms = {s: {0: HANG(g), .12: CRO(g)} for s, g in (("l", 1), ("r", -1))}
    for s in "lr": arms[s].update(rarms[s])
    FOR = lambda g: ((g*.75, -.25, -.6), (-g*.35, -.85, .4))         # "força!": cotovelos abertos, punhos cerrados à frente do peito
    for s, g in (("l", 1), ("r", -1)): arms[s].update({1.78: CRO(g), 1.97: ((g*.55, -.2, .8), (g*.45, -.25, .86)), 2.2: ((g*.65, -.2, .72), (g*.55, -.25, .8)),
                                                      2.5: FOR(g), 2.75: ((g*.8, -.15, -.5), (-g*.3, -.9, .3)), 3.0: FOR(g), 3.35: ((g*.3, -.05, -.9), (g*.2, -.4, -.85)), 3.8: HANG(g)})
    maos = {s: {0: ("relaxada", 1), .1: ("punho", .7), 1.7: ("punho", .7), 1.95: ("aberta", .8), 2.3: ("punho", 1), 3.2: ("punho", 1), 3.5: ("relaxada", 1)} for s in "lr"}
    return plano("GolCorrida", 3.8, steps, pel, prot, crot, head, arms, maos=maos)

# ======================= 5 REAÇÕES DE COBRANÇA PERDIDA =======================
# Referências: Furley & Roth (2021, J Sport Exerc Psychol — sistema de codificação de linguagem corporal em pênaltis): depois de um ERRO o cobrador
# passa mais tempo olhando para o CHÃO, a postura fica MENOS ERETA e o braço se mexe menos; observação de uma compilação de pênaltis decisivos
# perdidos (vídeo aberto e amostrado): cabeça baixa, mãos na cintura, um agachado, braços pendentes, caminhada lenta de volta.
# Todas: ombros caídos (clavículas, plan["ombros"]), o corpo inteiro participa e cada uma tem começo (o impacto do erro), desenvolvimento e final.
OMB_TRISTE = {0: (0, 0), .5: (-6, 9), 2.0: (-7, 10), 2.6: (-4, 6)}

def perdeu_cabeca_baixa():
    """"Ah!": as mãos sobem um pouco e caem batendo nas coxas, a cabeça despenca e os ombros caem; vira de costas e caminha três passos lentos,
    arrastados, com os braços pesados balançando; para, solta o ar e ergue um pouco a cabeça."""
    Y = -55; A, sd, c = caminho(Y)
    steps = {"r": [(.95, 1.35, END_R, sd(.30, -1), Y*.6), (1.85, 2.25, sd(.30, -1), sd(.95, -1), Y)], "l": [(1.40, 1.80, END_L, sd(.62, 1), Y*.8)]}
    pel = {0: (0, 0, .93), .22: (0, .01, .905), .45: (0, .02, .915), .95: (0, .02, .912), 1.35: c(.12, .905), 1.6: c(.30, .915), 1.8: c(.46, .905), 2.05: c(.62, .913),
           2.25: c(.78, .905), 2.5: c(.84, .915), 2.8: c(.86, .92)}
    prot = {0: (0, 6, 0), .22: (0, 12, 0), .6: (-2, 10, 0), 1.35: (Y*.5, 9, -2), 1.8: (Y*.85, 9, 2), 2.25: (Y, 9, -1), 2.8: (Y, 7, 0)}
    crot = {0: (0, 10, 0), .12: (0, 4, 0), .3: (0, 30, 0), .7: (-4, 28, 2), 1.35: (Y*.5 - 4, 26, -2), 1.8: (Y*.85 + 4, 26, 2), 2.25: (Y - 3, 26, -2), 2.55: (Y, 20, 0), 2.8: (Y, 16, 0)}
    head = {0: (20, 0), .12: (6, 0), .32: (46, 0), .9: (52, -4), 1.6: (48, 6), 2.25: (50, -4), 2.55: (34, 0), 2.8: (30, 0)}
    PESADO = lambda s: ((s*.08, -.12, -1), (s*.06, -.2, -1))
    arms = {s: {0: HANG(g), .14: ((g*.35, -.35, -.6), (g*.4, -.6, -.3)), .3: ((g*.16, .02, -1), (g*.1, -.1, -1)), .6: PESADO(g),
                1.35: ((g*.1, -.25, -.97), (g*.06, -.3, -.95)), 1.8: ((g*.1, .15, -.98), (g*.06, -.05, -1)), 2.25: ((g*.1, -.22, -.97), (g*.06, -.3, -.95)), 2.8: HANG(g)}
            for s, g in (("l", 1), ("r", -1))}
    arms["r"].update({1.35: ((-.1, .15, -.98), (-.06, -.05, -1)), 1.8: ((-.1, -.25, -.97), (-.06, -.3, -.95)), 2.25: ((-.1, .1, -.98), (-.06, -.05, -1))})   # braço oposto à perna
    maos = {s: {0: ("relaxada", 1), .12: ("aberta", .7), .4: ("relaxada", 1)} for s in "lr"}
    return plano("PerdeuCabecaBaixa", 2.8, steps, pel, prot, crot, head, arms, maos=maos, ombros=OMB_TRISTE)

def perdeu_maos_cintura():
    """As duas mãos vão à cintura; o peso passa para uma perna, a cabeça balança em "não"; o peso passa para a outra com um passo de acomodação,
    olha para o céu soltando o ar, depois para o chão; solta as mãos e relaxa."""
    steps = {"l": [(1.5, 1.8, END_L, END_L + V(.05, .10), 8)], "r": [(2.3, 2.6, END_R, END_R + V(-.02, .06), -6)]}
    pel = {0: (0, 0, .93), .5: (-.02, .02, .92), 1.1: (-.04, .02, .914), 1.8: (.03, .06, .916), 2.1: (.035, .06, .912), 2.6: (.02, .08, .92), 3.0: (.02, .08, .926)}
    prot = {0: (0, 6, 0), .5: (-4, 4, -3), 1.1: (-6, 3, -5), 1.8: (6, 3, 5), 2.1: (6, 2, 4), 2.6: (2, 4, 1), 3.0: (2, 4, 0)}
    crot = {0: (0, 10, 0), .5: (-6, 4, -2), 1.1: (-8, 2, -4), 1.5: (0, 4, 0), 1.85: (6, -6, 3), 2.15: (5, 14, 2), 2.6: (2, 12, 0), 3.0: (2, 7, 0)}
    head = {0: (20, 0), .5: (6, 0), .85: (10, -12), 1.05: (12, 12), 1.25: (12, -10), 1.45: (14, 6), 1.85: (-22, 0), 2.15: (34, 2), 2.6: (28, 0), 3.0: (18, 0)}   # "não" e o olhar para o céu
    arms = {s: {0: HANG(g), 3.0: HANG(g)} for s, g in (("l", 1), ("r", -1))}
    ik = {s: {0: ("cintura", 0), .25: ("cintura", 0), .7: ("cintura", 1), 2.3: ("cintura", 1), 2.75: ("cintura", 0), 3.0: ("cintura", 0)} for s in "lr"}
    ik["r"] = {0: ("cintura", 0), .32: ("cintura", 0), .8: ("cintura", 1), 2.2: ("cintura", 1), 2.7: ("cintura", 0), 3.0: ("cintura", 0)}   # as mãos chegam desencontradas
    maos = {s: {0: ("relaxada", 1), .45: ("cintura", 1), 2.3: ("cintura", 1), 2.75: ("relaxada", 1)} for s in "lr"}
    return plano("PerdeuMaosCintura", 3.0, steps, pel, prot, crot, head, arms, ik=ik, maos=maos, ombros={0: (0, 0), .6: (2, 2), 1.9: (4, 0), 2.2: (-5, 7), 3.0: (-3, 4)})

def perdeu_mao_rosto():
    """Freia o corpo com um tranco, leva a mão direita ao rosto (palma na testa) e a esquerda à cintura; segura um instante com a cabeça baixa;
    vira com um passo para trás, a mão do rosto desce devagar e os braços relaxam."""
    steps = {"r": [(1.45, 1.80, END_R, END_R + V(-.06, .26), -18)], "l": [(2.05, 2.35, END_L, END_L + V(-.04, .14), -10)]}
    pel = {0: (0, 0, .93), .25: (0, .02, .898), .6: (.01, .02, .91), 1.4: (.01, .03, .913), 1.80: (-.05, .13, .908), 2.35: (-.05, .17, .92), 2.8: (-.05, .17, .926)}
    prot = {0: (0, 6, 0), .25: (0, 12, 0), .9: (-6, 7, 2), 1.8: (-16, 5, -2), 2.35: (-14, 5, 0), 2.8: (-12, 4, 0)}
    crot = {0: (0, 10, 0), .12: (0, 2, 0), .3: (-2, 24, 0), .9: (-8, 20, 3), 1.4: (-10, 18, 2), 1.8: (-20, 12, -2), 2.35: (-16, 10, 0), 2.8: (-12, 8, 0)}
    head = {0: (20, 0), .12: (4, 0), .32: (36, 0), .9: (32, -6), 1.4: (30, -4), 1.8: (22, 8), 2.35: (18, 2), 2.8: (18, 0)}
    arms = {"l": {0: HANG(1), 2.8: HANG(1)}, "r": {0: HANG(-1), 2.8: HANG(-1)}}
    ik = {"r": {0: ("rosto", 0), .25: ("rosto", 0), .65: ("rosto", 1), 1.4: ("rosto", 1), 1.95: ("rosto", 0), 2.8: ("rosto", 0)},
          "l": {0: ("cintura", 0), .5: ("cintura", 0), 1.0: ("cintura", 1), 1.9: ("cintura", 1), 2.45: ("cintura", 0), 2.8: ("cintura", 0)}}
    maos = {"r": {0: ("relaxada", 1), .55: ("aberta", .7), 1.45: ("aberta", .7), 2.0: ("relaxada", 1)}, "l": {0: ("relaxada", 1), .9: ("cintura", 1), 1.95: ("cintura", 1), 2.4: ("relaxada", 1)}}
    return plano("PerdeuMaoRosto", 2.8, steps, pel, prot, crot, head, arms, ik=ik, maos=maos, ombros=OMB_TRISTE)

def perdeu_maos_cabeca():
    """As duas mãos vão à cabeça (cotovelos abertos) e o corpo inclina para TRÁS, olhando para cima sem acreditar; depois se curva para a frente
    ainda segurando a cabeça, dá um passo atrás, e os braços caem pesados."""
    steps = {"r": [(1.35, 1.7, END_R, END_R + V(-.03, .22), -8)], "l": [(2.05, 2.35, END_L, END_L + V(.02, .10), 6)]}
    pel = {0: (0, 0, .93), .4: (0, .03, .918), 1.0: (0, .05, .925), 1.35: (0, .04, .915), 1.7: (-.03, .13, .905), 2.35: (-.01, .16, .918), 3.0: (-.01, .16, .926)}
    prot = {0: (0, 6, 0), .45: (0, -2, 0), 1.0: (2, -5, 0), 1.7: (-8, 10, -1), 2.35: (-4, 7, 0), 3.0: (-3, 4, 0)}
    crot = {0: (0, 10, 0), .45: (0, -6, 0), 1.0: (2, -14, 0), 1.45: (-4, 10, 0), 1.8: (-8, 28, 0), 2.3: (-6, 22, 0), 2.7: (-4, 12, 0), 3.0: (-3, 7, 0)}
    head = {0: (20, 0), .45: (-6, 0), 1.0: (-22, 0), 1.45: (10, 4), 1.8: (34, 4), 2.3: (36, 0), 2.7: (24, 0), 3.0: (18, 0)}
    arms = {s: {0: HANG(g), 3.0: HANG(g)} for s, g in (("l", 1), ("r", -1))}
    ik = {s: {0: ("cabeca", 0), .15: ("cabeca", 0), .7: ("cabeca", 1), 2.0: ("cabeca", 1), 2.6: ("cabeca", 0), 3.0: ("cabeca", 0)} for s in "lr"}
    ik["r"] = {0: ("cabeca", 0), .22: ("cabeca", 0), .78: ("cabeca", 1), 2.1: ("cabeca", 1), 2.7: ("cabeca", 0), 3.0: ("cabeca", 0)}   # a segunda mão chega e sai depois
    maos = {s: {0: ("relaxada", 1), .4: ("apoio", 1), 2.0: ("apoio", 1), 2.5: ("relaxada", 1)} for s in "lr"}
    return plano("PerdeuMaosCabeca", 3.0, steps, pel, prot, crot, head, arms, ik=ik, maos=maos, ombros={0: (0, 0), 2.5: (0, 0), 2.8: (-5, 6), 3.0: (-4, 5)})

def perdeu_olha_chao():
    """Vira de costas para o gol olhando para o chão, agacha com as mãos nos joelhos (tronco à frente, respiração pesada), levanta devagar e relaxa."""
    Y1, Y2 = -45, -100
    R1, R2 = rot(Y1), rot(Y2)
    steps = {"l": [(.45, .8, END_L, R1 @ END_L + V(.03, .03), Y1), (1.55, 1.85, R1 @ END_L + V(.03, .03), R2 @ END_L + V(.06, .05), Y2)],
             "r": [(.95, 1.3, END_R, R2 @ END_R + V(-.02, .05), Y2 + 6)]}
    pel = {0: (0, 0, .93), .45: (0, .01, .918), .8: (.01, .02, .92), 1.3: (.01, .04, .916), 1.85: (.03, .06, .90), 1.98: (.03, .08, .80), 2.3: (.03, .08, .79),
           2.6: (.03, .07, .89), 2.82: (.03, .06, .922), 3.0: (.03, .06, .924)}
    prot = {0: (0, 6, 0), .45: (-5, 8, 0), .8: (Y1, 8, 2), 1.3: (Y2 + 10, 10, -2), 1.85: (Y2, 10, 0), 1.98: (Y2, 30, 0), 2.3: (Y2, 32, 0), 2.6: (Y2, 14, 0), 2.85: (Y2, 6, 0), 3.0: (Y2, 5, 0)}
    crot = {0: (0, 10, 0), .45: (-8, 22, 0), .8: (Y1 - 4, 26, 0), 1.3: (Y2 + 6, 24, 0), 1.85: (Y2, 22, 0), 1.98: (Y2, 44, 0), 2.14: (Y2, 38, 0), 2.3: (Y2, 44, 0),
            2.6: (Y2, 20, 0), 2.85: (Y2, 8, 0), 3.0: (Y2, 7, 0)}   # agachado, o peito sobe e desce (respiração pesada)
    head = {0: (20, 0), .45: (44, -8), 1.1: (48, 6), 1.85: (40, 0), 2.1: (20, 0), 2.45: (24, 0), 2.75: (30, 0), 3.0: (22, 0)}
    arms = {s: {0: HANG(g), .5: ((g*.15, -.25, -.96), (g*.10, -.35, -.93)), 1.2: ((g*.18, .05, -.98), (g*.12, -.15, -.98)), 1.8: ((g*.2, -.25, -.95), (g*.14, -.4, -.9)), 3.0: HANG(g)}
            for s, g in (("l", 1), ("r", -1))}
    ik = {s: {0: ("joelho", 0), 1.7: ("joelho", 0), 1.98: ("joelho", 1), 2.35: ("joelho", 1), 2.7: ("joelho", 0), 3.0: ("joelho", 0)} for s in "lr"}
    maos = {s: {0: ("relaxada", 1), 1.9: ("apoio", 1), 2.4: ("apoio", 1), 2.7: ("relaxada", 1)} for s in "lr"}
    return plano("PerdeuOlhaChao", 3.0, steps, pel, prot, crot, head, arms, ik=ik, maos=maos, ombros={0: (0, 0), .6: (-5, 8), 1.9: (-4, 10), 2.8: (-3, 5), 3.0: (-2, 3)})

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
        for e_ in STEPS[s]:
            t_off, t_on, P0_, P1_, yw = e_[:5]
            if t_off <= tc <= t_on:
                u = (tc - t_off)/(t_on - t_off); h1, kp = arc((P1_ - P0_).length)
                if len(e_) > 5:                                       # SALTO: o calcanhar sai primeiro e o pé sobe junto com o corpo (altura do plano), quase sem apontar a ponta para baixo
                    h1 = e_[5]; y0 = yw_prev(s, t_off); ys = y0 + (yw - y0)*min(1, u/.6)
                    path = pchip({0: tuple(ankle_at(s, P0_, y0, 22)), .3: tuple(P0_.lerp(P1_, .3) + Vector((0, 0, AN + h1))), .7: tuple(P0_.lerp(P1_, .75) + Vector((0, 0, AN + .75*h1))),
                                  1: tuple(P1_ + Vector((0, 0, AN + .015)))})
                    return Vector(path(u)), pchip({0: 22, .3: 12, .7: 2, 1: -4})(u), ys, False
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
    # ---- MOVIMENTO SOLTO: cada articulação segue a sua chave com uma MOLA amortecida própria (frequência e amortecimento diferentes), então o tronco
    # chega um pouco depois da pelve, a cabeça atrasa e passa levemente do ponto, o braço acompanha e o antebraço chega por último (chicote).
    # Antes, todas as articulações eram avaliadas no MESMO instante com interpolação monótona: começavam e paravam juntas ("boneco de madeira").
    # O primeiro quadro e os últimos 0,35 s voltam exatamente às chaves: a transição com o estado anterior e o seguinte não muda.
    def mola(seq, w, z):
        x = list(seq[0]); v = [0.0]*len(x); out = [tuple(x)]; h = 1/FPS/4
        for tgt in seq[1:]:
            for _ in range(4):
                for k in range(len(x)): a_ = w*w*(tgt[k] - x[k]) - 2*z*w*v[k]; v[k] += a_*h; x[k] += v[k]*h
            out.append(tuple(x))
        m_ = int(.35*FPS)
        for i in range(max(1, len(seq) - m_), len(seq)):
            u = (i - (len(seq) - m_))/m_; u = u*u*(3 - 2*u); out[i] = tuple(o + (t - o)*u for o, t in zip(out[i], seq[i]))
        return out
    FR = range(N + 1)
    K_ = plan.get("rigidez", 1.0)                                                           # gestos muito rápidos (socos alternados) pedem molas mais firmes
    CROTF = mola([C_ROT(f/FPS) for f in FR], 13*K_, .72)                                       # tronco: segue a pelve com ~0,06 s de atraso
    HEADF = mola([HEAD(f/FPS) for f in FR], 9, .55)                                         # cabeça: mais atraso e um pouco de overshoot
    ARMSF = {s: [a_ + b_ for a_, b_ in zip(mola([ARMF[s](f/FPS)[:3] for f in FR], 15*K_, .72), mola([ARMF[s](f/FPS)[3:] for f in FR], 11*K_, .55))] for s in ARMF}   # braço, depois antebraço
    BREATH = lambda tc: 1.3*math.sin(2*math.pi*tc/1.5)*max(0, min(1, (tc - .6)/.8))*max(0, min(1, (T - .2 - tc)/.5))   # respiração depois do esforço (some no fim)
    OMBROS = pchip({t: tuple(v) for t, v in plan.get("ombros", {0: (0, 0)}).items()})    # (elevação, protração) extra das clavículas: ombros caídos na frustração
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
        """punho, polo do cotovelo, direção dos dedos e direção da PALMA para cada gesto de contato (a palma virada para o que a mão toca)"""
        sg = 1 if s == "l" else -1
        if kind == "cintura": return P + Rp @ Vector((sg*.20, -.01, .14)), P + Rp @ Vector((sg*.8, .25, .30)), Rp @ Vector((-sg*.25, -.85, -.45)), Rp @ Vector((-sg, .1, 0))   # palma no quadril; dedos à frente e para baixo
        if kind == "joelho":
            K_ = arm.pose.bones[f"calf_{s}"].head.copy(); return K_ + Rp @ Vector((sg*.035, -.02, .13)), Sv + Rp @ Vector((sg*.6, .2, -.2)), Rp @ Vector((-sg*.1, -.6, -.8)), Rp @ Vector((0, .1, -1))
        if kind == "peito":   return P + Rc @ Vector((-sg*.02, -.20, .40)), Sv + Rc @ Vector((sg*.5, -.2, -.6)), Rc @ Vector((-sg*.8, -.2, .3)), Rc @ Vector((0, 1, 0))   # palma no peito
        if kind == "rosto":
            W_ = HC + Rh @ Vector((sg*.03, -(HAX.y*.75 + .04), -.11)); return W_, Sv + Rc @ Vector((sg*.12, -.55, -.6)), Rh @ Vector((-sg*.2, -.2, .95)), Rh @ Vector((0, 1, 0))   # palma no rosto
        W_ = HC + Rh @ Vector((sg*(HAX.x*.78 + .03), .02, HAX.z*.62 + .035))   # cabeca: punho sobre a lateral alta da cabeça, palma no TOPO, dedos para o centro; cotovelos abertos
        return W_, Sv + Rc @ Vector((sg*.9, .05, .5)), Rh @ Vector((-sg*.6, .6, .3)), Rh @ Vector((-sg*.45, 0, -.9))
    FWD = BR.FWD0
    MARGEM, PUSH, TWP = BR.MARGEM, {"l": 0.0, "r": 0.0}, {}
    sc.frame_start, sc.frame_end = 0, N
    PUSHF = {s: [Vector()]*(N + 1) for s in "lr"}
    for passo in (1, 2):                                             # 1º passe mede o empurrão anticolisão por quadro; ele é suavizado no tempo e o 2º passe é o definitivo
      TOES = []
      for f in range(N + 1):
          tc = f/FPS; sc.frame_set(f)
          (x, y, z), (yw, ln, tl), ch, (hp, hy) = P_POS(tc), P_ROT(tc), CROTF[f], HEADF[f]; z += DZ[f]; ch = (ch[0], ch[1] + BREATH(tc), ch[2])
          Rp, Rc = rot(yw, ln, tl), rot(*ch); P = Vector((x, y, z))
          set_rot("pelvis", Rp, P); key("pelvis", f, loc=True)
          qp, qc = Rp.to_quaternion(), Rc.to_quaternion()
          for i, b in enumerate(("spine_01", "spine_02", "spine_03")): set_rot(b, qp.slerp(qc, (i + 1)/3).to_matrix()); key(b, f)
          Rh = Matrix.Rotation(D(hy), 3, "Z") @ Rc @ Matrix.Rotation(D(hp), 3, "X")
          set_rot("neck_01", qc.slerp(Rh.to_quaternion(), .5).to_matrix()); key("neck_01", f); set_rot("Head", Rh); key("Head", f)
          vl.update(); HC = arm.pose.bones["Head"].matrix @ HC_LOCAL
          def pose_braco(s, push):                                      # braço, mão e dedos de um lado; push = deslocamento do alvo do punho (colisão)
              v = ARMSF[s][f]; w = IKW[s](tc)[0] if s in IKW else 0; hd = None; pdir = None
              def resolve():
                  nonlocal hd, pdir
                  ua, fa = Rc @ Vector(v[:3]), Rc @ Vector(v[3:])
                  if w > 1e-3:                                         # gesto de contato: IK analítico até o alvo, misturado com o braço livre
                      vl.update(); Sv = arm.pose.bones[f"upperarm_{s}"].head.copy(); W_, pole, hd, pdir = alvo(IKK[s], s, P, Rp, Rc, Sv, HC, Rh)
                      E_, W2 = arm_ik(Sv, W_, pole); ua = ua.normalized().lerp((E_ - Sv).normalized(), w); fa = fa.normalized().lerp((W2 - E_).normalized(), w)
                      hd = (fa.normalized().lerp(hd.normalized(), w)) if hd is not None else None
                  return ua, fa
              ua, fa = resolve()
              # CINTURA ESCAPULAR: a clavícula sobe com o braço acima do ombro (ritmo escápulo-umeral ~1:2) e vai à frente com o braço à frente;
              # nas reações de frustração os ombros caem (plan["ombros"]). Sem isso o braço subia "pendurado" num ombro de madeira.
              sg_ = 1 if s == "l" else -1; un = ua.normalized(); elev = math.degrees(math.asin(max(-1, min(1, un.dot(Rc @ Vector((0, 0, 1)))))))
              ex, px = OMBROS(tc); ce = max(-8, min(28, .33*max(0, elev + 20) + ex)); cp = max(-6, min(16, 14*un.dot(Rc @ FWD) + px))
              set_rot(f"clavicle_{s}", Rc @ Matrix.Rotation(D(sg_*ce), 3, FWD) @ Matrix.Rotation(D(-sg_*cp), 3, "Z"))
              if w > 1e-3: ua, fa = resolve()                          # o ombro mudou de lugar: refaz o IK do gesto com o ombro novo
              if push.length > 1e-6:                                   # encostando no corpo: o punho final (gesto + braço livre já misturados) é empurrado para fora (cotovelo no mesmo plano)
                  vl.update(); Sv = arm.pose.bones[f"upperarm_{s}"].head.copy(); E0 = Sv + ua.normalized()*LU; W0 = E0 + fa.normalized()*LF
                  E_, W2 = arm_ik(Sv, W0 + push, E0 + (E0 - (Sv + W0)/2)*2); ua, fa = E_ - Sv, W2 - E_
              Ru, Rf, Hw, TWP[s] = BR.arm_hand(REST, s, ua, fa, Rc @ FWD, hd, pdir, w, TWP.get(s))   # palma virada para o que a mão toca (pronação dividida cotovelo/punho)
              set_rot(f"upperarm_{s}", Ru); set_rot(f"lowerarm_{s}", Rf); set_rot(f"hand_{s}", Hw)
              pose_, k_ = mao(s, max(0, tc - .07))                     # dedos (bracos.py): fecham/abrem um pouco DEPOIS do braço (não ao mesmo tempo)
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
              for b in (f"clavicle_{s}", f"upperarm_{s}", f"lowerarm_{s}", f"hand_{s}") + tuple(BR.finger_quats(REST, s)): key(b, f)
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
    lows = [(min(m["ball_l"].translation.z, m["ball_r"].translation.z, (m["ball_l"] @ Vector((0, arm.data.bones["ball_l"].length, 0))).z, (m["ball_r"] @ Vector((0, arm.data.bones["ball_r"].length, 0))).z), i) for i, m in enumerate(fr)]
    low, low_f = min(lows)
    # mãos x corpo: menor distância (com sinal) das juntas e pontas dos dedos à pele (cabeça, pescoço, tronco, quadril, coxas); negativa = atravessou
    hd_min, hd_onde = min(((lambda r: (r[0], f"mão {s}→{r[2]}@{i/FPS:.2f}s"))(BR.colisao_mao(arm, CORPO, s, m)) for i, m in enumerate(fr) for s in "lr"), key=lambda r: r[0])
    pv = [(fr[i]["pelvis"].translation - fr[i - 1]["pelvis"].translation).length*FPS for i in range(1, N + 1)]
    rep = {"clipe": out_name, "duracao_s": T, "deriva_apoio_mm": {s: apoio_deriva(s) for s in "lr"}, "pe_mais_baixo_z_m": round(low, 3), "pe_mais_baixo_t": round(low_f/FPS, 2), "pelve_abaixada_cm": round(-min(DZ)*100, 1), "pelve_abaixada_t": round(DZ.index(min(DZ))/FPS, 2),
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
