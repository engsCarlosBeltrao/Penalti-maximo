# CHUTE DE PEITO DO PÉ — sequência completa (corrida de aproximação → plantio → recuo → chute → acompanhamento → salto → passada de recuperação),
# animada no Blender 5.2 (modo background) sobre o ESQUELETO do athlete.glb, que não é reexportado: sai só esqueleto + clipe (assets/models/anim/chute.glb).
#
# Base biomecânica (Li et al. 2016, PMC5154722; Shan & Zhang 2011, PMC3224572; Augustus et al. 2024, J Biomech 163:111920):
#  - aproximação em ângulo de ~30–45° (aqui 35°), última passada mais longa; pé de apoio ao lado e um pouco atrás da bola;
#  - recuo (do pé de chute sair do chão ao pé de apoio tocar): coxa recua pouco, canela muito (joelho flexiona ~100°+);
#  - após o apoio: rotação axial da pelve e flexão do quadril com o joelho ainda flexionando; depois a coxa FREIA e a canela acelera (chicote),
#    pico de velocidade do pé perto do contato, tornozelo travado em flexão plantar;
#  - arco de tensão: quadril do chute estendido + tronco torcido para o lado contrário + braço oposto estendido e abduzido; liberação: tronco flexiona
#    e gira para o lado do chute, braço oposto flexiona e cruza; após o chute forte, pulo para dissipar o embalo e passada de recuperação.
#
# Técnica (skills blender-animation / blender-character-rigging): IK de 2 ossos nas duas pernas (alvo = tornozelo, polo = joelho); nas fases de apoio o alvo
# fica TRAVADO no gramado (e, ao sair, os dedos ficam presos enquanto o calcanhar sobe); na perna de chute os alvos vêm de ângulos de coxa e canela
# (curvas monótonas, sem overshoot) resolvidos no plano da perna; pelve/coluna/cabeça/braços por curvas; chave em todo quadro (60 fps);
# bake visual (bake_action.py, "self-bake") e exportação glTF.
# Espaço do clipe: bola em (0, 0, 0.11); o gol fica em -Y; esquerda do jogador = +X; chuta com a perna DIREITA. Contato no quadro CONTACT.
# Uso: blender -b --factory-startup --python-exit-code 1 -P tools/blender/chute.py -- assets/models/athlete.glb assets/models/anim/chute.glb .claude/skills
import bpy, sys, os, json, math
from mathutils import Vector, Matrix, Quaternion

args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT, SKILLS = args[0], args[1], args[2]
FPS, T0, T1 = 60, -1.3, 1.0                                          # o clipe vai de tc = -1,3 s a +1,0 s (tc = 0 no contato)
CONTACT, END = round(-T0*FPS), round((T1 - T0)*FPS)
BALL = Vector((0, 0, .11))
D, R2D = math.radians, math.degrees
F = lambda tc: (tc - T0)*FPS                                         # tc → quadro
TC = lambda f: f/FPS + T0

bpy.ops.wm.read_factory_settings(use_empty=True)
assert bpy.ops.import_scene.gltf(filepath=SRC) == {"FINISHED"}
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
# geometria VISÍVEL da chuteira de chute (materiais Boots/Sole, vértices presos ao pé direito), no referencial de repouso do osso foot_r:
# o contato é resolvido contra esses vértices, não contra a posição de um osso
BOOT = []
for o in bpy.data.objects:
    if o.type != "MESH": continue
    gi = {g.index: g.name for g in o.vertex_groups}; mats = [m.name if m else "" for m in o.data.materials]
    face_mat = {}
    for poly in o.data.polygons:
        for vi in poly.vertices: face_mat[vi] = mats[poly.material_index] if poly.material_index < len(mats) else ""
    for v in o.data.vertices:
        if face_mat.get(v.index) not in ("Boots", "Sole") or not v.groups: continue
        g = max(v.groups, key=lambda g: g.weight)
        if gi.get(g.group) in ("foot_r", "ball_r", "ball_leaf_r"): BOOT.append((o.matrix_world @ v.co, face_mat[v.index]))
for o in [o for o in bpy.data.objects if o != arm]: bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene; sc.render.fps = FPS; sc.frame_start, sc.frame_end = 0, END
vl = bpy.context.view_layer
for pb in arm.pose.bones: pb.rotation_mode = "QUATERNION"
REST = {b.name: b.matrix_local.copy() for b in arm.data.bones}
AN = REST["foot_r"].translation.z                                    # altura do tornozelo com o pé chapado
LT = (REST["calf_r"].translation - REST["thigh_r"].translation).length
LS = (REST["foot_r"].translation - REST["calf_r"].translation).length
HIP = {s: REST[f"thigh_{s}"].translation - REST["pelvis"].translation for s in "lr"}
BZ = REST["ball_r"].translation.z                                    # altura da articulação dos dedos com o pé chapado

# ---------- curvas: interpolação cúbica monótona (Fritsch–Carlson), sem overshoot ----------
def pchip(keys):
    ts = sorted(keys); vs = [keys[t] for t in ts]
    def scalar(xs, ys):
        n = len(xs); h = [xs[i + 1] - xs[i] for i in range(n - 1)]; dl = [(ys[i + 1] - ys[i])/h[i] for i in range(n - 1)]
        m = [dl[0]] + [0.0]*(n - 2) + [dl[-1]] if n > 1 else [0.0]
        for i in range(1, n - 1):
            if dl[i - 1]*dl[i] <= 0: m[i] = 0.0
            else: w1, w2 = 2*h[i] + h[i - 1], h[i] + 2*h[i - 1]; m[i] = (w1 + w2)/(w1/dl[i - 1] + w2/dl[i])
        def f(x):
            if x <= xs[0]: return ys[0]
            if x >= xs[-1]: return ys[-1]
            i = max(k for k in range(n - 1) if xs[k] <= x); u = (x - xs[i])/h[i]
            h00, h10, h01, h11 = 2*u**3 - 3*u**2 + 1, u**3 - 2*u**2 + u, -2*u**3 + 3*u**2, u**3 - u**2
            return h00*ys[i] + h10*h[i]*m[i] + h01*ys[i + 1] + h11*h[i]*m[i + 1]
        return f
    if isinstance(vs[0], (tuple, list)): fs = [scalar(ts, [v[k] for v in vs]) for k in range(len(vs[0]))]; return lambda x: tuple(f(x) for f in fs)
    return scalar(ts, vs)

# ---------- rotações e poses no espaço do esqueleto ----------
def rot(yaw=0, lean=0, tilt=0):                                      # yaw em Z (- = vira para -X), lean em X (+ = para a frente), tilt em Y (+ = inclina para +X)
    return Matrix.Rotation(D(yaw), 3, "Z") @ Matrix.Rotation(D(lean), 3, "X") @ Matrix.Rotation(D(tilt), 3, "Y")
def fwd(yaw): return rot(yaw) @ Vector((0, -1, 0))
def left(yaw): return rot(yaw) @ Vector((1, 0, 0))
def set_rot(name, R, loc=None):
    vl.update(); pb = arm.pose.bones[name]
    M = (R @ REST[name].to_3x3()).to_4x4(); M.translation = loc if loc is not None else pb.head.copy(); pb.matrix = M
def aim(name, d):
    y = REST[name].to_3x3().col[1].normalized(); set_rot(name, y.rotation_difference(Vector(d).normalized()).to_matrix())
PREV = {}
def key(name, f, loc=False):
    pb = arm.pose.bones[name]; q = pb.rotation_quaternion
    if name in PREV and PREV[name].dot(q) < 0: pb.rotation_quaternion = -q
    PREV[name] = pb.rotation_quaternion.copy(); pb.keyframe_insert("rotation_quaternion", frame=f, group=name)
    if loc: pb.keyframe_insert("location", frame=f, group=name)

# ---------- IK das pernas ----------
def empty(n):
    e = bpy.data.objects.new(n, None); e.empty_display_size = .08; sc.collection.objects.link(e); e.rotation_mode = "QUATERNION"; return e
IKT = {s: empty(f"IK_pe_{s}") for s in "lr"}; POLE = {s: empty(f"Polo_joelho_{s}") for s in "lr"}
for s in "lr":
    c = arm.pose.bones[f"calf_{s}"].constraints.new("IK"); c.target = IKT[s]; c.pole_target = POLE[s]; c.chain_count = 2
    arm.pose.bones[f"foot_{s}"].constraints.new("COPY_ROTATION").target = IKT[s]
best = None                                                          # ângulo do polo que mantém o joelho no plano da perna
for a in (-180, -90, 0, 90):
    for s in "lr":
        arm.pose.bones[f"calf_{s}"].constraints[0].pole_angle = D(a)
        IKT[s].matrix_world = Matrix.Translation(REST[f"foot_{s}"].translation + Vector((0, 0, .06))) @ REST[f"foot_{s}"].to_3x3().to_4x4()
        POLE[s].location = REST[f"calf_{s}"].translation + Vector((0, -.6, 0))
    vl.update(); err = sum((arm.pose.bones[f"calf_{s}"].head - REST[f"calf_{s}"].translation).length for s in "lr")
    if best is None or err < best[1]: best = (a, err)
for s in "lr": arm.pose.bones[f"calf_{s}"].constraints[0].pole_angle = D(best[0])
def foot_m(s, yaw, pitch): return rot(yaw, pitch) @ REST[f"foot_{s}"].to_3x3()
FINV = REST["foot_r"].inverted(); BOOT_L = [(FINV @ p, m) for p, m in BOOT]   # chuteira no referencial do osso do pé
def boot_gap(an, yaw, pitch):                                        # menor distância (m) da superfície da chuteira à superfície da bola; < 0 = atravessa
    M = foot_m("r", yaw, pitch); best = (9, None, None)
    for lp, m in BOOT_L:
        d = (an + M @ lp - BALL).length - .11
        if d < best[0]: best = (d, m, lp)
    return best
def toe_off(s): return REST[f"ball_{s}"].translation - REST[f"foot_{s}"].translation
def ankle_at(s, pos, yaw, pitch):                                    # tornozelo de um pé cuja posição chapada é pos (tornozelo no chão), girando sobre os DEDOS (pitch > 0)
    flat = Vector((pos.x, pos.y, AN)); bj = flat + rot(yaw) @ toe_off(s); return bj - rot(yaw, pitch) @ toe_off(s)

# ================= PLANEJAMENTO DA SEQUÊNCIA =================
AP = -35                                                             # yaw da corrida de aproximação (35° em relação à direção do chute)
A, N = fwd(AP), left(AP)                                             # direção de deslocamento e lado esquerdo do corredor
PL = Vector((.26, .06, 0))                                           # pé de APOIO (esquerdo): ao lado e ligeiramente atrás da bola
R3 = PL - A*1.35 - N*.18                                             # última passada (longa): pé direito
L2 = R3 - A*1.10 + N*.18
R1 = L2 - A*.90 - N*.18
S = R1 - A*.60                                                       # posição inicial (parado, de frente para a bola, na linha de corrida)
R0, L0 = Vector((2.236, 3.548, 0)), Vector((2.568, 3.316, 0))     # pés da pose de espera do jogo (rig.js, modo idle) — o clipe começa exatamente onde o atleta está parado
YAW_INI = {"r": -38.0, "l": -31.9}                                   # e com os pés girados como na pose de espera
R4 = Vector((-.08, -.52, 0)); L5 = Vector((.20, -.98, 0)); R5 = Vector((-.10, -.92, 0))   # aterrissagem do pulo, passada de recuperação e pé que vem fechar a base
KICK_OFF, KICK_LAND = -.233, .40                                     # pé de chute sai do chão / volta ao chão (aterrissagem do pulo)
# eventos de pé (tc): (início do balanço, toque, de, para, yaw do pé)
STEPS = {"r": [(-1.20, -.95, R0, R1, AP), (-.80, -.40, R1, R3, AP), (KICK_OFF, KICK_LAND, R3, R4, 0), (.60, .86, R4, R5, 0)],
         "l": [(-1.02, -.66, L0, L2, AP), (-.52, -.117, L2, PL, -20), (.16, .52, PL, L5, -5)]}

# pelve: posição e (yaw, lean, tilt); peito: (yaw, lean, tilt); cabeça: inclinação sobre o peito
P_POS = pchip({-1.30: tuple(S.xy) + (.93,), -1.10: (S.x - .05, S.y - .07, .92), -.88: tuple((R1 + N*.04).xy) + (.88,), -.73: (1.88, 2.52, .93),
               -.59: tuple((L2 - N*.04).xy) + (.88,), -.46: (1.36, 1.72, .93), -.32: tuple((R3 + N*.04).xy) + (.88,), -.18: (.62, .72, .92),
               -.117: tuple((PL - A*.46 - N*.02).xy) + (.88,), -.06: (.44, .40, .87), 0: (.38, .34, .88), .12: (.25, .04, .90), .24: (.17, -.20, .97), .40: (.08, -.44, .88),
               .50: (.07, -.62, .88), .60: (.06, -.76, .89), .72: (.05, -.86, .91), .86: (.05, -.935, .925), .94: (.05, -.95, .93), 1.0: (.05, -.95, .93)})
P_ROT = pchip({-1.30: (AP, 4, 0), -1.10: (AP, 8, 0), -.88: (AP - 3, 12, 0), -.59: (AP + 3, 12, 0), -.32: (AP - 5, 10, -2), -.233: (-48, 6, 0),
               -.117: (-55, 0, 8), -.06: (-35, 4, 12), 0: (-10, 8, 15), .12: (5, 8, 8), .20: (9, -4, 4), .28: (10, 0, 2), .40: (8, 10, 0), .60: (4, 6, 0), 1.0: (0, 4, 0)})
C_ROT = pchip({-1.30: (AP, 6, 0), -1.10: (AP, 10, 0), -.88: (AP + 5, 14, 0), -.59: (AP - 3, 14, 0), -.32: (AP + 5, 12, 0), -.233: (-25, 5, 5),
               -.117: (-20, -8, 14), -.06: (-22, 4, 18), 0: (-25, 18, 18), .12: (-2, 18, 10), .20: (6, 2, 5), .28: (8, 6, 3), .40: (6, 16, 0), .60: (2, 9, 0), 1.0: (0, 6, 0)})
HEAD = pchip({-1.30: 20, -.50: 28, -.117: 38, 0: 40, .12: 30, .24: 18, .45: 8, 1.0: 5})
# braços (direção do braço e do antebraço no referencial do PEITO: frente = -Y, esquerda = +X, cima = +Z); s = +1 braço esquerdo, -1 direito
FWDA = lambda s: ((s*.10, -.55, -.83), (-s*.15, -.80, .45)); BACKA = lambda s: ((s*.18, .62, -.76), (s*.05, -.55, -.83)); RELAX = lambda s: ((s*.2, 0, -1), (s*.15, -.35, -.9))
ARMS = {"l": {-1.30: RELAX(1), -1.10: RELAX(1), -.88: FWDA(1), -.59: BACKA(1), -.32: ((.25, -.5, -.83), (0, -.85, .4)), -.17: ((.6, .3, -.3), (.7, .1, -.2)),
              -.117: ((.85, .35, .15), (.9, .2, .15)), -.06: ((.9, .05, .2), (.85, -.35, .25)), 0: ((.9, -.2, .1), (.7, -.6, .1)),
              .12: ((.55, -.7, -.35), (.15, -.85, -.3)), .26: ((.45, -.45, -.75), (.2, -.75, -.5)), .40: ((.55, -.15, -.8), (.35, -.55, -.7)), .60: ((.3, -.05, -.95), (.2, -.35, -.9)), 1.0: RELAX(1)},
        "r": {-1.30: RELAX(-1), -1.10: RELAX(-1), -.88: BACKA(-1), -.59: FWDA(-1), -.32: BACKA(-1), -.20: ((-.25, -.45, -.85), (-.1, -.85, -.3)),
              -.117: ((-.3, -.55, -.75), (-.1, -.8, -.4)), -.06: ((-.4, -.1, -.85), (-.25, -.4, -.8)), 0: ((-.45, .4, -.8), (-.3, .1, -.95)),
              .12: ((-.5, .25, -.82), (-.4, -.25, -.85)), .26: ((-.6, .05, -.8), (-.45, -.4, -.75)), .40: ((-.5, -.1, -.85), (-.3, -.45, -.82)), .60: ((-.3, -.05, -.95), (-.2, -.35, -.9)), 1.0: RELAX(-1)}}
ARMF = {s: pchip({t: tuple(v[0]) + tuple(v[1]) for t, v in tab.items()}) for s, tab in ARMS.items()}

def hip_pos(s, tc): (x, y, z), (yw, ln, tl) = P_POS(tc), P_ROT(tc); return Vector((x, y, z)) + rot(yw, ln, tl) @ HIP[s]
def solve2(x, y):                                                    # IK de 2 segmentos no plano: x = à frente, y = para baixo → ângulos (coxa, canela) a partir da vertical
    d = min(math.hypot(x, y), LT + LS - 1e-4); a = math.atan2(x, y)
    k = math.acos(max(-1, min(1, (LT*LT + d*d - LS*LS)/(2*LT*d)))); th = a + k
    kx, ky = LT*math.sin(th), LT*math.cos(th); return R2D(th), R2D(math.atan2(x - kx, y - ky))
def leg_plane(psi, beta):                                            # base do plano da perna: f (frente horizontal) e g ("para baixo" inclinado de beta para a direita)
    f = fwd(psi); r = -left(psi); g = Vector((0, 0, -1))*math.cos(D(beta)) + r*math.sin(D(beta)); return f, g
def plane_coords(tc, P, psi, beta):
    f, g = leg_plane(psi, beta); v = P - hip_pos("r", tc); return v.dot(f), v.dot(g)

# ---------- perna de chute: ângulos de coxa e canela (graus a partir da vertical, + = para a frente) ----------
PSI = pchip({KICK_OFF: AP, -.117: -32, -.05: -22, 0: -8, .10: -3, .24: 0, KICK_LAND: 0})
PITCH_K = pchip({KICK_OFF: 35, -.18: 80, -.117: 110, -.085: 115, -.05: 100, -.025: 75, 0: 60, .10: 50, .17: 40, .24: 30, .31: 15, KICK_LAND: -8})
A_C = BALL + rot(PSI(0)) @ Vector((0, .13, .125))                    # tornozelo no contato: peito do pé atrás da bola, na altura do centro
# o tornozelo recua na direção do golpe até a superfície da chuteira (peito do pé) apenas ENCOSTAR na superfície da bola (folga alvo -1 mm)
lo, hi = -.05, .12
for _ in range(40):
    mid = (lo + hi)/2
    if boot_gap(A_C - fwd(PSI(0))*mid, PSI(0), PITCH_K(0))[0] < -.001: lo = mid
    else: hi = mid
A_C = A_C - fwd(PSI(0))*hi; CONTACT_SHIFT = hi
h0 = hip_pos("r", 0); vC = A_C - h0; BETA_C = R2D(math.atan2(vC.dot(-left(PSI(0))), -vC.z))
BETA = pchip({KICK_OFF: 0, -.117: BETA_C*.6, 0: BETA_C, .17: BETA_C*.4, .31: 0, KICK_LAND: 0})
TH_C, SH_C = solve2(*plane_coords(0, A_C, PSI(0), BETA(0)))
R3_OFF = ankle_at("r", R3, AP, 35)      # tornozelo no instante em que o pé de chute sai: dedos no chão, calcanhar no ar
TH_O, SH_O = solve2(*plane_coords(KICK_OFF, R3_OFF, PSI(KICK_OFF), BETA(KICK_OFF)))
ANG = pchip({KICK_OFF: (TH_O, SH_O), -.18: (-20, -95), -.117: (-18, -118), -.085: (-5, -128), -.05: (18, -105), -.025: (32, -60),
             0: (TH_C, SH_C), .04: (TH_C + 16, SH_C + 42), .10: (78, 66), .17: (95, 86), .24: (88, 70), .31: (52, 30), .37: (22, 5)})
def kick_leg(tc):                                                    # (tornozelo, joelho, pitch, yaw) da perna de chute no balanço
    th, sh = ANG(tc); f, g = leg_plane(PSI(tc), BETA(tc)); h = hip_pos("r", tc)
    kn = h + f*(LT*math.sin(D(th))) + g*(LT*math.cos(D(th))); an = kn + f*(LS*math.sin(D(sh))) + g*(LS*math.cos(D(sh))); return an, kn, PITCH_K(tc), PSI(tc)

# ---------- pés na corrida / apoio: alvo travado no chão, balanço em arco ----------
def yw_prev(s, t_off):
    yw = YAW_INI[s]
    for (a_, b_, p0_, p1_, y_) in STEPS[s]:
        if b_ <= t_off: yw = y_
    return yw
def foot_state(s, tc):
    """(tornozelo, pitch, yaw, no_chao) da perna s fora do balanço do chute"""
    evs = STEPS[s]
    for (t_off, t_on, P0_, P1_, yw) in evs:
        if t_off <= tc <= t_on:                                      # balanço: sai pela ponta, sobe atrás, desce de calcanhar
            u = (tc - t_off)/(t_on - t_off)
            path = pchip({0: tuple(ankle_at(s, P0_, yw_prev(s, t_off), 35)), .35: tuple(P0_.lerp(P1_, .22) + Vector((0, 0, .30))),
                          .75: tuple(P0_.lerp(P1_, .78) + Vector((0, 0, .17))), 1: tuple(P1_ + Vector((0, 0, AN + .02)))})
            y0 = yw_prev(s, t_off); ys = y0 + (yw - y0)*min(1, u/.6)**2*(3 - 2*min(1, u/.6))   # o pé gira para o novo yaw no ar, não no instante em que sai
            return Vector(path(u)), pchip({0: 35, .35: 60, .75: -5, 1: -12})(u), ys, False
    pos, yw, t_on_last, t_next_off = (R0 if s == "r" else L0), YAW_INI[s], -9, 9
    for (t_off, t_on, P0_, P1_, yw_) in evs:
        if tc >= t_on: pos, yw, t_on_last = P1_, yw_, t_on
        if t_off > tc: t_next_off = min(t_next_off, t_off)
    k_on = min(1, (tc - t_on_last)/.05) if t_on_last > -9 else 1     # calcanhar → pé chapado logo após o toque
    k_off = max(0, 1 - (t_next_off - tc)/.07) if t_next_off < 9 else 0   # calcanhar sobe antes de sair, com os dedos presos
    pitch = -12*(1 - k_on) + 35*k_off**2
    an = ankle_at(s, pos, yw, pitch) if pitch > 0 else Vector((pos.x, pos.y, AN + .02*(1 - k_on)))
    return an, pitch, yw, True

def toe_flat_w(s, tc):                                               # peso dos dedos chapados logo depois que o pé sai do chão (desdobram em ~0,1 s)
    offs = [e[0] for e in STEPS[s] if e[0] <= tc] + ([KICK_OFF] if s == "r" and tc >= KICK_OFF else [])
    return max(0, 1 - (tc - max(offs))/.10) if offs else 0

# ================= QUADROS-CHAVE (todos os quadros, 60 fps) =================
TOES = []
for f in range(0, END + 1):
    tc = TC(f); sc.frame_set(f)
    (x, y, z), (yw, ln, tl), ch = P_POS(tc), P_ROT(tc), C_ROT(tc)
    Rp, Rc = rot(yw, ln, tl), rot(*ch)
    set_rot("pelvis", Rp, Vector((x, y, z))); key("pelvis", f, loc=True)
    qp, qc = Rp.to_quaternion(), Rc.to_quaternion()
    for i, b in enumerate(("spine_01", "spine_02", "spine_03")): set_rot(b, qp.slerp(qc, (i + 1)/3).to_matrix()); key(b, f)
    Rh = Rc @ Matrix.Rotation(D(HEAD(tc)), 3, "X")
    set_rot("neck_01", qc.slerp(Rh.to_quaternion(), .5).to_matrix()); key("neck_01", f); set_rot("Head", Rh); key("Head", f)
    for s in "lr":
        v = ARMF[s](tc); aim(f"upperarm_{s}", Rc @ Vector(v[:3])); key(f"upperarm_{s}", f); aim(f"lowerarm_{s}", Rc @ Vector(v[3:])); key(f"lowerarm_{s}", f)
    for s in "lr":
        if s == "r" and KICK_OFF < tc < KICK_LAND:
            an, kn, pitch, fy = kick_leg(tc); w = min(1, (tc - KICK_OFF)/.05, (KICK_LAND - tc)/.06)      # entra/sai suave do balanço do chute
            if w < 1:
                an0, p0, y0, _ = foot_state("r", KICK_OFF if tc - KICK_OFF < .05 else KICK_LAND)
                an = an0.lerp(an, w); pitch = p0 + (pitch - p0)*w; fy = y0 + (fy - y0)*w
            hp = hip_pos("r", tc); pole = kn + (kn - (hp + an)/2).normalized()*.6
        else:
            an, pitch, fy, _ = foot_state(s, tc); hp = hip_pos(s, tc)
            pole = hp + fwd(P_ROT(tc)[0])*.8 + Vector((0, 0, -.4))
        IKT[s].matrix_world = Matrix.Translation(an) @ foot_m(s, fy, pitch).to_4x4()
        IKT[s].keyframe_insert("location", frame=f); IKT[s].keyframe_insert("rotation_quaternion", frame=f)
        POLE[s].location = pole; POLE[s].keyframe_insert("location", frame=f)
    TOES.append((f, tc, {s: (foot_state(s, tc) if not (s == "r" and KICK_OFF < tc < KICK_LAND) else (None, 0, 0, False)) for s in "lr"}))
# dedos (osso ball_*): segundo passe, com os pés já resolvidos pelo IK em cada quadro
IK_ERR = {"l": (0, 0), "r": (0, 0)}
for f, tc, st in TOES:
    sc.frame_set(f); vl.update()
    for s in "lr":
        an, pitch, fy, ground = st[s]; pb = arm.pose.bones[f"ball_{s}"]
        if ground: e = (pb.parent.head - an).length; IK_ERR[s] = max(IK_ERR[s], (round(e, 4), f))
        w = 1 if ground and pitch > 0 else toe_flat_w(s, tc)            # dedos chapados no gramado enquanto o calcanhar sobe e logo após sair
        pb.rotation_quaternion = (1, 0, 0, 0)
        if w > 0:
            set_rot(f"ball_{s}", rot(yw_prev(s, tc + 1e-3) if not ground else fy)); q = pb.rotation_quaternion.copy()
            pb.rotation_quaternion = Quaternion((1, 0, 0, 0)).slerp(q, w)
        key(f"ball_{s}", f)
act = arm.animation_data.action; act.name = "Chute"; act.use_fake_user = True

# ---------- BAKE (skill blender-animation): IK + Copy Rotation → chaves FK em todos os quadros ----------
sys.path.insert(0, os.path.join(SKILLS, "blender-animation", "scripts")); import bake_action
baked = bake_action.run(source=arm.name, target=arm.name, actions=["Chute"], clean=False)
for o in [o for o in bpy.data.objects if o != arm]: bpy.data.objects.remove(o, do_unlink=True)
for pb in arm.pose.bones:
    for c in list(pb.constraints): pb.constraints.remove(c)

# ================= VERIFICAÇÃO (números) =================
JOINTS = ["pelvis", "Head", "hand_l", "hand_r", "foot_l", "foot_r", "ball_l", "ball_r", "calf_l", "calf_r", "thigh_r"]
traj = []
for f in range(0, END + 1):
    sc.frame_set(f); vl.update(); pb = arm.pose.bones
    traj.append({j: pb[j].head.copy() for j in JOINTS} | {"toe_l": pb["ball_l"].tail.copy(), "toe_r": pb["ball_r"].tail.copy()})
def drift(j, t_a, t_b): fa, fb = round(F(t_a)), round(F(t_b)); return max((traj[i][j] - traj[fa][j]).xy.length for i in range(fa, fb + 1))
vel = lambda j, i: (traj[i][j] - traj[i - 1][j]).length*FPS
toe_v = [vel("toe_r", i) for i in range(1, END + 1)]
peak = 1 + max(range(len(toe_v)), key=lambda i: toe_v[i])
c = traj[CONTACT]; laces = ((c["foot_r"] + c["ball_r"])/2 - BALL).length - .11
lowz = lambda tr: min(tr["toe_l"].z, tr["toe_r"].z, tr["ball_l"].z, tr["ball_r"].z)
lowf = min(range(END + 1), key=lambda i: lowz(traj[i]))
def accs(j): a = [((traj[i + 1][j] - traj[i][j]) - (traj[i][j] - traj[i - 1][j])).length*FPS*FPS for i in range(1, END)]; k = max(range(len(a)), key=lambda i: a[i]); return [round(a[k], 1), round(TC(k + 1), 3)]
acc = {j: accs(j) for j in ("pelvis", "Head", "hand_l", "hand_r", "calf_l", "calf_r")}
def boot_gap_frame(f):                                               # mesma medida com a pose BAKEADA do quadro f (matriz real do osso do pé)
    sc.frame_set(f); vl.update(); M = arm.pose.bones["foot_r"].matrix; best = (9, None, None)
    for lp, m in BOOT_L:
        p = M @ lp; d = (p - BALL).length - .11
        if d < best[0]: best = (d, m, p)
    return best
TOQUE = boot_gap_frame(CONTACT)[2]                                   # ponto da chuteira que toca a bola (o jogo o usa para compensar a altura/largura de cada atleta)
GEO = {"contato": round(boot_gap_frame(CONTACT)[0]*1000, 1), "quadro_antes": round(boot_gap_frame(CONTACT - 1)[0]*1000, 1),
       "menor_antes_do_contato": round(min(boot_gap_frame(f)[0] for f in range(round(F(KICK_OFF)), CONTACT))*1000, 1), "recuo_tornozelo_m": round(CONTACT_SHIFT, 4)}
def _fim():                                                          # equilíbrio no fim: pelve parada e sobre a base dos pés
    last = traj[END]; mid = (last["foot_l"] + last["foot_r"])/2
    return {"vel_pelve_ultimo_quadro_m_s": round(vel("pelvis", END), 3), "pelve_parada_desde_tc": round(TC(min(i for i in range(CONTACT, END + 1) if all(vel("pelvis", k) < .02 for k in range(i, END + 1)))), 3),
            "pelve_menos_meio_dos_pes_m": [round(c, 3) for c in (last["pelvis"] - mid).xy], "base_pes_m": round((last["foot_l"] - last["foot_r"]).xy.length, 3)}
FIM = _fim()
def knee_ang(i): tr = traj[i]; return round(R2D((tr["calf_r"] - tr["thigh_r"]).angle(tr["foot_r"] - tr["calf_r"])), 1)
report = {"ok": True, "fps": FPS, "frames": [0, END], "contact_frame": CONTACT, "pole_angle": best[0], "baked": baked.get("baked", baked),
          "apoio_deriva_horizontal_m": {"plantio_ao_contato": round(drift("ball_l", -.06, .10), 4), "R1": round(drift("ball_r", -.90, -.80), 4), "L2": round(drift("ball_l", -.61, -.52), 4), "R3": round(drift("ball_r", -.35, -.233), 4), "pouso_R4": round(drift("ball_r", .46, .60), 4), "fecha_R5": round(drift("ball_r", .92, 1.0), 4), "recuperacao_L5": round(drift("ball_l", .56, 1.0), 4)},
          "chuteira_geometria_ate_bola_mm": GEO, "pico_vel_ponta_pe": {"quadro": peak, "rel_contato_s": round((peak - CONTACT)/FPS, 3), "m_s": round(max(toe_v), 1), "no_contato_m_s": round(toe_v[CONTACT - 1], 1)},
          "flexao_joelho_chute_graus": {"toe_off": knee_ang(round(F(KICK_OFF))), "apoio_toca": knee_ang(round(F(-.117))), "max": max(knee_ang(i) for i in range(round(F(KICK_OFF)), CONTACT)), "contato": knee_ang(CONTACT)},
          "erro_ik_apoio_m_quadro": IK_ERR, "fim": FIM, "pe_mais_baixo_z_m": round(lowz(traj[lowf]), 3), "quadro_pe_mais_baixo": lowf, "aceleracao_max_m_s2": acc,
          "contato_angulos_coxa_canela": [round(TH_C, 1), round(SH_C, 1)], "beta_contato": round(BETA_C, 1)}

# ---------- exportação: só esqueleto + clipe ----------
arm["chute_contato_s"] = CONTACT/FPS; arm["chute_fps"] = FPS; arm["chute_inicio_tc"] = T0; arm["chute_fim_tc"] = T1; arm["bola"] = [0.0, .11, 0.0]; arm["chute_toque"] = [round(TOQUE.x, 4), round(TOQUE.z, 4), round(-TOQUE.y, 4)]   # em coordenadas glTF (y para cima)
sc.frame_set(0)
for o in bpy.data.objects: o.select_set(o == arm)
vl.objects.active = arm
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
r = bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", use_selection=True, export_animations=True, export_animation_mode="ACTIONS",
                              export_force_sampling=True, export_extras=True, export_skins=False, export_morph=False, export_materials="NONE")
report["export"] = list(r); report["bytes"] = os.path.getsize(OUT)
print("@@JSON@@" + json.dumps(report))
