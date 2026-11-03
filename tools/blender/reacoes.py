# ENTRADA (caminhada até o ponto de partida), GOL (comemoração) e PERDEU (frustração) do cobrador — Blender 5.2, modo background,
# no ESQUELETO do athlete.glb (sai só esqueleto + clipe; o modelo não é reexportado). Mesma técnica de tools/blender/cobranca.py e repouso.py:
#  - pés por IK de 2 ossos com apoios TRAVADOS no gramado (o calcanhar sobe girando sobre os dedos; no balanço o pé sobe em arco e desce de calcanhar);
#  - pelve/coluna/cabeça por curvas monótonas (pchip), com o alcance da perna de apoio respeitado (a pelve só abaixa o necessário);
#  - braços por direção do braço/antebraço no referencial do peito, ou por IK analítico até um alvo (mão na cintura, mão no rosto);
#  - dedos relaxados (ou fechados no punho do gol); bake visual (bake_action.py); o canhoto é o espelho exato osso a osso.
# Referencial do clipe: o do CORPO (de frente para -Y, esquerda = +X). ENTRADA termina com a pelve na origem e os pés exatamente na pose de espera
# (a do repouso e do 1º quadro das cobranças); GOL e PERDEU começam com a pelve na origem e os pés como no fim das cobranças.
# Uso: blender -b --factory-startup --python-exit-code 1 -P tools/blender/reacoes.py -- assets/models/athlete.glb assets/models/anim .claude/skills
import bpy, sys, os, json, math
from mathutils import Vector, Matrix, Quaternion

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
sm = lambda u: (lambda v: v*v*(3 - 2*v))(min(1, max(0, u)))
V = lambda x, y: Vector((x, y, 0))

# ---- poses de referência (no referencial do corpo) ----
IDLE_R, IDLE_L = rot(35) @ Vector((-.144, .148, 0)), rot(35) @ Vector((.188, -.084, 0))   # pés da espera (= repouso e 1º quadro das cobranças)
END_R, END_L = V(-.15, .03), V(.15, -.03)                                                  # pés no fim do chute médio (relativos à pelve)
HANG = lambda s: ((s*.13, -.04, -1), (s*.10, -.30, -.95))                                  # braço solto (o do repouso)
WFWD = lambda s, k: ((s*.10, -.30*k, -.95), (s*.05, -.62*k - .1, -.80))                   # caminhada: braço à frente (cotovelo ~25°)
WBCK = lambda s, k: ((s*.12, .30*k, -.95), (s*.10, .08*k - .12, -.99))                    # caminhada: braço atrás

def plano_entrada():
    """Caminha ~2 m de trás para a frente até o ponto de espera, desacelerando; o penúltimo passo ajusta, o último fecha a base."""
    P0 = 1.98
    steps = {"r": [(.04, .48, V(-.10, P0 + .04), V(-.10, 1.40), -3), (.98 + .05, 1.48, V(-.10, 1.40), V(-.10, .30), -3), (1.98 + .04, 2.36, V(-.10, .30), IDLE_R, -3.0)],
             "l": [(.48 + .05, .98, V(.10, P0 + .04), V(.10, .80), 3), (1.48 + .05, 1.98, V(.10, .80), IDLE_L, 3.1)]}
    init = {"r": (V(-.10, P0 + .04), 0), "l": (V(.10, P0 + .04), 0)}
    pel = {0: (0, P0, .93), .2: (0, P0 - .07, .925), .48: (-.02, 1.63, .905), .73: (-.025, 1.33, .93), .98: (.02, 1.03, .905), 1.23: (.025, .76, .93),
           1.48: (-.02, .50, .905), 1.73: (-.02, .30, .925), 1.98: (.015, .14, .91), 2.17: (.01, .07, .922), 2.36: (0, .03, .92), 2.55: (0, .01, .926), 2.7: (0, 0, .926)}
    prot = {0: (0, 2, 0), .48: (-4, 5, -2), .98: (4, 5, 2), 1.48: (-4, 5, -2), 1.98: (3, 4, 1.5), 2.36: (-1, 3.5, 0), 2.7: (0, 3.2, 0)}
    crot = {0: (0, 4, 0), .48: (5, 6, 1), .98: (-5, 6, -1), 1.48: (5, 6, 1), 1.98: (-3, 5.5, -.5), 2.36: (1, 5, 0), 2.7: (0, 5, 0)}
    head = {0: (12, 0), .98: (14, 0), 1.6: (18, 0), 2.2: (21, 0), 2.7: (22, 0)}            # olha o caminho e, perto do fim, a bola
    k = lambda t: 1 if t < 1.6 else max(.25, 1 - (t - 1.6)/1.0)                              # amplitude do braço cai com a desaceleração
    arms = {"l": {0: HANG(1), .48: WFWD(1, k(.48)), .98: WBCK(1, k(.98)), 1.48: WFWD(1, k(1.48)), 1.98: WBCK(1, k(1.98)), 2.36: HANG(1), 2.7: HANG(1)},
            "r": {0: HANG(-1), .48: WBCK(-1, k(.48)), .98: WFWD(-1, k(.98)), 1.48: WBCK(-1, k(1.48)), 1.98: WFWD(-1, k(1.98)), 2.36: HANG(-1), 2.7: HANG(-1)}}
    return dict(nome="Entrada", T=2.7, steps=steps, init=init, pel=pel, prot=prot, crot=crot, head=head, arms=arms, ik={}, fist={0: 0, 2.7: 0})

def plano_gol():
    """Reação (agacha e cerra os punhos) → trote curto girando para a torcida com o punho direito subindo → pulinho → braços abertos → relaxa."""
    Y = 50                                                                                    # gira até ~50° para a esquerda (para a torcida lateral)
    A = lambda d: rot(Y) @ Vector((0, -d, 0))
    sd = lambda d, s, dy=0: A(d) + rot(Y) @ Vector((s*.11, dy, 0))                       # ponto do caminho, ao lado esquerdo (+1) ou direito (-1)
    R1, L1, R2, L2, R3, L3, R4 = sd(.40, -1), sd(.78, 1), sd(1.15, -1), sd(1.50, 1), sd(1.62, -1), sd(1.70, 1), sd(1.68, -1, .04)
    steps = {"r": [(.48, .72, END_R, R1, 25), (.98, 1.20, R1, R2, Y), (1.62, 1.92, R2, R3, Y), (2.55, 2.85, R3, R4, Y)],     # trote curto → pulinho com os dois pés → fecha a base
             "l": [(.62, .90, END_L, L1, 35), (1.12, 1.40, L1, L2, Y), (1.62, 1.92, L2, L3, Y)]}
    init = {"r": (END_R, 0), "l": (END_L, 0)}
    c = lambda d, z, dx=0: tuple((A(d) + V(dx, 0)).xy) + (z,)
    pel = {0: (0, 0, .93), .22: (0, .02, .87), .45: (0, 0, .885), .72: c(.30, .90, -.03), .90: c(.58, .92, .02), 1.20: c(.95, .90, -.02), 1.40: c(1.28, .91, .02),
           1.58: c(1.48, .855), 1.75: c(1.60, 1.01), 1.92: c(1.66, .86), 2.15: c(1.66, .915), 2.6: c(1.66, .926, .01), 2.85: c(1.67, .924, -.005), 3.4: c(1.67, .926)}
    prot = {0: (0, 6, 0), .22: (0, 12, 0), .45: (6, 6, 0), .72: (22, 8, -2), 1.20: (Y - 4, 7, 2), 1.40: (Y + 2, 6, -2), 1.58: (Y, 10, 0), 1.75: (Y, -4, 0), 1.92: (Y, 8, 0),
            2.15: (Y, -2, 0), 2.6: (Y, -1, 0), 3.4: (Y, 3, 0)}
    crot = {0: (0, 10, 0), .22: (-4, 20, 2), .45: (10, 4, -2), .72: (30, 4, -3), 1.20: (Y + 6, 3, 3), 1.40: (Y - 4, 4, -2), 1.58: (Y + 2, 12, 0), 1.75: (Y + 4, -10, -4),
            1.92: (Y, 2, 0), 2.15: (Y - 2, -8, 2), 2.6: (Y + 2, -6, 0), 3.0: (Y, 2, 0), 3.4: (Y, 5, 0)}
    head = {0: (25, 0), .22: (-5, 0), .45: (5, 0), .9: (8, 0), 1.58: (0, 0), 1.75: (-22, 0), 1.92: (-10, 0), 2.15: (-18, 0), 2.6: (-12, 0), 3.0: (6, 0), 3.4: (12, 0)}
    PUNHO_SOBE = lambda s: ((s*.12, -.25, .96), (s*.05, -.05, 1))                              # braço em riste, cotovelo quase estendido
    PUNHO_PEITO = lambda s: ((s*.35, -.25, -.90), (-s*.25, -.90, .35))                         # punho cerrado junto ao peito (cotovelo ~100°)
    ABRE = lambda s, up: ((s*.80, -.15, up), (s*.70, -.40, up + .25))                           # braço aberto (asa), cotovelo levemente flexionado
    arms = {"l": {0: HANG(1), .22: PUNHO_PEITO(1), .45: PUNHO_PEITO(1), .72: WBCK(1, 1.2), 1.20: WFWD(1, 1.1), 1.58: ((.5, -.3, -.3), (.3, -.7, .1)), 1.75: ABRE(1, .55),
                  2.15: ABRE(1, .70), 2.6: ABRE(1, .45), 3.0: ((.35, -.1, -.85), (.25, -.4, -.85)), 3.4: HANG(1)},
            "r": {0: HANG(-1), .22: PUNHO_PEITO(-1), .45: ((-.25, -.40, -.30), (.15, -.65, .70)), .72: ((-.15, -.30, .55), (-.05, -.15, .98)), .90: PUNHO_SOBE(-1),
                  1.20: ((-.15, -.20, .55), (-.05, -.30, .90)), 1.58: PUNHO_SOBE(-1), 1.75: PUNHO_SOBE(-1), 2.15: ABRE(-1, .80), 2.6: ABRE(-1, .50),
                  3.0: ((-.35, -.1, -.85), (-.25, -.4, -.85)), 3.4: HANG(-1)}}
    return dict(nome="Gol", T=3.4, steps=steps, init=init, pel=pel, prot=prot, crot=crot, head=head, arms=arms, ik={}, fist={0: 0, .2: 1, 2.4: 1, 3.0: 0, 3.4: 0})

def plano_perdeu():
    """Freia o corpo, a cabeça cai, a mão direita vai ao rosto por um instante, as duas mãos vão à cintura, um passo atrás, solta o ar e relaxa."""
    steps = {"r": [(1.30, 1.62, END_R, END_R + V(-.04, .26), -12)], "l": [(2.05, 2.35, END_L, END_L + V(.03, .12), 6)]}
    init = {"r": (END_R, 0), "l": (END_L, 0)}
    pel = {0: (0, 0, .93), .35: (0, .02, .905), .9: (.02, .02, .915), 1.3: (.0, .03, .915), 1.62: (-.04, .12, .91), 2.05: (-.02, .14, .925), 2.35: (.01, .17, .922),
           2.8: (.01, .18, .926), 3.0: (.01, .18, .926)}
    prot = {0: (0, 6, 0), .35: (-3, 9, 0), .9: (-6, 7, 2), 1.62: (-14, 4, -2), 2.05: (-8, 3, 1), 2.35: (-4, 3, 0), 3.0: (-3, 3, 0)}
    crot = {0: (0, 10, 0), .35: (-2, 22, 0), .9: (-8, 20, 3), 1.3: (-10, 12, 2), 1.62: (-16, 8, -2), 2.05: (-8, 4, 1), 2.4: (-4, 7, 0), 3.0: (-3, 6, 0)}
    head = {0: (20, 0), .35: (38, 0), .9: (34, -6), 1.3: (30, -4), 1.62: (24, 8), 2.05: (14, 4), 2.4: (20, 0), 3.0: (16, 0)}   # olha para baixo, depois para o gol
    arms = {"l": {0: HANG(1), .35: ((.25, -.05, -.97), (.2, -.2, -.96)), 1.0: HANG(1), 2.4: HANG(1), 3.0: HANG(1)},
            "r": {0: HANG(-1), .35: ((-.25, -.05, -.97), (-.2, -.2, -.96)), 3.0: HANG(-1)}}
    # IK das mãos: (alvo no referencial do PEITO/da pelve, peso). "rosto" = na testa, à frente; "cintura" = linha do cinto, sobre a crista ilíaca
    ik = {"r": {"alvo": {0: ("rosto", 0), .4: ("rosto", 0), .75: ("rosto", 1), 1.10: ("rosto", 1), 1.45: ("cintura", 1), 2.05: ("cintura", 1), 2.55: ("cintura", 0), 3.0: ("cintura", 0)}},
          "l": {"alvo": {0: ("cintura", 0), .9: ("cintura", 0), 1.35: ("cintura", 1), 2.05: ("cintura", 1), 2.55: ("cintura", 0), 3.0: ("cintura", 0)}}}
    return dict(nome="Perdeu", T=3.0, steps=steps, init=init, pel=pel, prot=prot, crot=crot, head=head, arms=arms, ik=ik, fist={0: 0, 3.0: 0})

def build(plan, out_name, mirror):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    assert bpy.ops.import_scene.gltf(filepath=SRC) == {"FINISHED"}
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    for o in [o for o in bpy.data.objects if o != arm]: bpy.data.objects.remove(o, do_unlink=True)
    sc = bpy.context.scene; sc.render.fps = FPS; vl = bpy.context.view_layer
    for pb in arm.pose.bones: pb.rotation_mode = "QUATERNION"
    REST = {b.name: b.matrix_local.copy() for b in arm.data.bones}
    AN = REST["foot_r"].translation.z; LT = (REST["calf_r"].translation - REST["thigh_r"].translation).length; LS = (REST["foot_r"].translation - REST["calf_r"].translation).length
    HIP = {s: REST[f"thigh_{s}"].translation - REST["pelvis"].translation for s in "lr"}
    LU = (REST["lowerarm_r"].translation - REST["upperarm_r"].translation).length; LF = (REST["hand_r"].translation - REST["lowerarm_r"].translation).length
    def set_rot(name, R, loc=None):
        vl.update(); pb = arm.pose.bones[name]; M = (R @ REST[name].to_3x3()).to_4x4(); M.translation = loc if loc is not None else pb.head.copy(); pb.matrix = M
    def aim(name, d): y = REST[name].to_3x3().col[1].normalized(); set_rot(name, y.rotation_difference(Vector(d).normalized()).to_matrix())
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
    def foot_state(s, tc):                                           # (tornozelo, pitch, yaw, no chão)
        for (t_off, t_on, P0_, P1_, yw) in STEPS[s]:
            if t_off <= tc <= t_on:
                u = (tc - t_off)/(t_on - t_off); d = (P1_ - P0_).length; h1 = .10 + .13*min(1, d/.7); kp = min(1, h1/.30)**1.5
                path = pchip({0: tuple(ankle_at(s, P0_, yw_prev(s, t_off), 30*kp)), .38: tuple(P0_.lerp(P1_, .25) + Vector((0, 0, h1))),
                              .75: tuple(P0_.lerp(P1_, .80) + Vector((0, 0, .6*h1))), 1: tuple(P1_ + Vector((0, 0, AN + .015)))})
                y0 = yw_prev(s, t_off); uu = min(1, u/.6); ys = y0 + (yw - y0)*uu*uu*(3 - 2*uu)
                return Vector(path(u)), pchip({0: 30*kp, .38: 45*kp, .75: -4*kp, 1: -8*kp})(u), ys, False
        pos, yw, t_on_last, t_next = plan["init"][s][0], plan["init"][s][1], -9, 9
        for e in STEPS[s]:
            if tc >= e[1]: pos, yw, t_on_last = e[3], e[4], e[1]
            if e[0] > tc: t_next = min(t_next, e[0])
        k_on = min(1, (tc - t_on_last)/.06) if t_on_last > -9 else 1
        nxt = next((e for e in STEPS[s] if e[0] == t_next), None); kp_n = min(1, (.10 + .13*min(1, (nxt[3] - nxt[2]).length/.7))/.30)**1.5 if nxt else 1
        k_off = max(0, 1 - (t_next - tc)/.08) if t_next < 9 else 0
        pitch = -8*(1 - k_on) + 30*kp_n*k_off**2
        an = ankle_at(s, pos, yw, pitch) if pitch > 0 else Vector((pos.x, pos.y, AN + .015*(1 - k_on)))
        return an, pitch, yw, True
    P_POS, P_ROT, C_ROT, HEAD = pchip(plan["pel"]), pchip(plan["prot"]), pchip(plan["crot"]), pchip(plan["head"]); FIST = pchip(plan["fist"])
    ARMF = {s: pchip({t: tuple(v[0]) + tuple(v[1]) for t, v in tab.items()}) for s, tab in plan["arms"].items()}
    # alcance: a perna de apoio nunca estica além do comprimento (senão o IK arrasta o pé): a pelve abaixa só o necessário, suavizado
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
    IKW = {s: pchip({t: (w,) for t, (_, w) in plan["ik"][s]["alvo"].items()}) for s in plan["ik"]}
    def ik_kind(s, tc):
        ks = sorted(plan["ik"][s]["alvo"]); kind = plan["ik"][s]["alvo"][ks[0]][0]
        for t_ in ks:
            if t_ <= tc + 1e-9: kind = plan["ik"][s]["alvo"][t_][0]
        return kind
    FINGERS = [f"{d}_0{i}_{s}" for s in "lr" for d in ("index", "middle", "ring", "pinky", "thumb") for i in (1, 2, 3)]
    sc.frame_start, sc.frame_end = 0, N
    TOES = []
    for f in range(N + 1):
        tc = f/FPS; sc.frame_set(f)
        (x, y, z), (yw, ln, tl), ch, (hp, hy) = P_POS(tc), P_ROT(tc), C_ROT(tc), HEAD(tc); z += DZ[f]
        Rp, Rc = rot(yw, ln, tl), rot(*ch)
        set_rot("pelvis", Rp, Vector((x, y, z))); key("pelvis", f, loc=True)
        qp, qc = Rp.to_quaternion(), Rc.to_quaternion()
        for i, b in enumerate(("spine_01", "spine_02", "spine_03")): set_rot(b, qp.slerp(qc, (i + 1)/3).to_matrix()); key(b, f)
        Rh = Matrix.Rotation(D(hy), 3, "Z") @ Rc @ Matrix.Rotation(D(hp), 3, "X")
        set_rot("neck_01", qc.slerp(Rh.to_quaternion(), .5).to_matrix()); key("neck_01", f); set_rot("Head", Rh); key("Head", f)
        for s in "lr":
            sg = 1 if s == "l" else -1; v = ARMF[s](tc); ua, fa = Rc @ Vector(v[:3]), Rc @ Vector(v[3:])
            w = IKW[s](tc)[0] if s in IKW else 0
            if w > 1e-3:                                             # mão até um alvo (IK analítico; cotovelo para fora/baixo)
                vl.update(); Sv = arm.pose.bones[f"upperarm_{s}"].head.copy(); kind = ik_kind(s, tc)
                if kind == "cintura": W_ = Vector((x, y, z)) + Rp @ Vector((sg*.17, .03, .14)); pole = Vector((x, y, z)) + Rp @ Vector((sg*.8, .25, .30))
                else: hd = arm.pose.bones["Head"].head.copy(); W_ = hd + Rc @ Vector((sg*.04, -.17, .02)); pole = Sv + Rc @ Vector((sg*.45, .10, -.55))
                E_, W2 = arm_ik(Sv, W_, pole); ua = ua.normalized().lerp((E_ - Sv).normalized(), w); fa = fa.normalized().lerp((W2 - E_).normalized(), w)
            aim(f"upperarm_{s}", ua); key(f"upperarm_{s}", f); aim(f"lowerarm_{s}", fa); key(f"lowerarm_{s}", f)
        for s in "lr":
            an, pitch, fy, _ = foot_state(s, tc); hp_ = hip_pos(s, tc)
            IKT[s].matrix_world = Matrix.Translation(an) @ foot_m(s, fy, pitch).to_4x4(); IKT[s].keyframe_insert("location", frame=f); IKT[s].keyframe_insert("rotation_quaternion", frame=f)
            POLE[s].location = hp_ + rot(fy) @ Vector((0, -.8, -.4)); POLE[s].keyframe_insert("location", frame=f)
        TOES.append((f, tc, {s: foot_state(s, tc) for s in "lr"}))
    for f, tc, st in TOES:                                           # 2º passe: dedos do pé chapados no apoio, mãos (punho/palma), dedos das mãos
        sc.frame_set(f); vl.update()
        for s in "lr":
            an, pitch, fy, ground = st[s]; pb = arm.pose.bones[f"ball_{s}"]; pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
            if ground and pitch > 0: set_rot(f"ball_{s}", rot(fy))
            key(f"ball_{s}", f)
            sg = 1 if s == "l" else -1; hb = arm.pose.bones[f"hand_{s}"]; w = IKW[s](tc)[0] if s in IKW else 0
            hb.rotation_quaternion = Quaternion(Vector((1, 0, 0)), D(-6*FIST(tc))) if w < 1e-3 else Quaternion((1, 0, 0, 0))
            if w > 1e-3:                                             # palma voltada ao corpo (cintura) ou ao rosto
                kind = ik_kind(s, tc); R0_ = REST[f"hand_{s}"].to_3x3(); f0 = R0_.col[1].normalized(); n0 = Vector((0, 0, -1))
                rp = arm.pose.bones["pelvis"].matrix.to_3x3() if kind == "cintura" else rot(*C_ROT(tc))
                f1 = (rot(*P_ROT(tc)) @ Vector((-sg*.25, -.55, -.8))).normalized() if kind == "cintura" else (rot(*C_ROT(tc)) @ Vector((-sg*.55, -.15, .82))).normalized()
                n1 = (rot(*P_ROT(tc)) @ Vector((-sg, 0, 0))) if kind == "cintura" else (rot(*C_ROT(tc)) @ Vector((0, .9, -.1))); n1 = (n1 - f1*n1.dot(f1)).normalized()
                B0 = Matrix((f0, (n0 - f0*n0.dot(f0)).normalized(), f0.cross(n0).normalized())).transposed(); B1 = Matrix((f1, n1, f1.cross(n1))).transposed()
                Rw = B1 @ B0.inverted(); par = hb.parent.matrix.to_3x3(); restrel = REST[hb.parent.name].to_3x3().inverted() @ R0_
                hb.rotation_quaternion = Quaternion((1, 0, 0, 0)).slerp((restrel.inverted() @ par.inverted() @ Rw @ R0_).to_quaternion(), w)
            key(f"hand_{s}", f)
        k = FIST(tc)
        for nm in FINGERS:                                           # mão relaxada (como no repouso) → punho cerrado no gol
            pb = arm.pose.bones[nm]; d = REST[nm].to_3x3().col[1].normalized(); ax = d.cross(Vector((0, 0, -1)))
            if ax.length < 1e-4: continue
            base = (16 if nm[-4:-2] == "01" else 24 if nm[-4:-2] == "02" else 18)*(.55 if nm.startswith("thumb") else 1)
            ang = base*(1 + 2.6*k) if not nm.startswith("thumb") else base*(1 + 1.2*k)
            pb.rotation_quaternion = Quaternion(REST[nm].to_3x3().inverted() @ ax.normalized(), D(ang)); key(nm, f)
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
    def apoio_deriva(s):                                             # deriva da articulação dos dedos em cada apoio (do toque +0,06 s até a saída)
        worst = 0; ons = [(-9, None)] + [(e[1], e) for e in STEPS[s]]; sname = s if not mirror else ("l" if s == "r" else "r")
        for t_on, _ in ons:
            offs = [e[0] for e in STEPS[s] if e[0] > t_on]; a_ = math.ceil(max(0, t_on + .06)*FPS); b_ = math.floor((min(offs) if offs else T)*FPS)
            if b_ > a_: worst = max(worst, max((fr[i][f"ball_{sname}"].translation - fr[a_][f"ball_{sname}"].translation).xy.length for i in range(a_, b_ + 1)))
        return round(worst*1000, 1)
    low = min(min(m["ball_l"].translation.z, m["ball_r"].translation.z, (m["ball_l"] @ Vector((0, arm.data.bones["ball_l"].length, 0))).z, (m["ball_r"] @ Vector((0, arm.data.bones["ball_r"].length, 0))).z) for m in fr)
    pv = [(fr[i]["pelvis"].translation - fr[i - 1]["pelvis"].translation).length*FPS for i in range(1, N + 1)]
    rep = {"clipe": out_name, "duracao_s": T, "deriva_apoio_mm": {s: apoio_deriva(s) for s in "lr"}, "pe_mais_baixo_z_m": round(low, 3), "pelve_abaixada_cm": round(-min(DZ)*100, 1),
           "vel_pelve_max_m_s": round(max(pv), 2), "vel_pelve_fim_m_s": round(pv[-1], 3), "pelve_fim": [round(c, 3) for c in fr[N]["pelvis"].translation],
           "pes_fim": {s: [round(c, 3) for c in fr[N][f"foot_{s}"].translation.xy] for s in "lr"}}
    if plan["nome"] == "Gol": zs = [m["pelvis"].translation.z for m in fr]; rep["salto_pelve_m"] = round(max(zs) - zs[0], 3)
    arm["clipe_reacao"] = plan["nome"]; arm["clipe_duracao_s"] = T; arm["clipe_pe"] = "l" if mirror else "r"
    sc.frame_set(0)
    for o in bpy.data.objects: o.select_set(o == arm)
    vl.objects.active = arm
    os.makedirs(os.path.abspath(OUT_DIR), exist_ok=True); out = os.path.join(os.path.abspath(OUT_DIR), out_name)
    r = bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_animations=True, export_animation_mode="ACTIONS",
                                  export_force_sampling=True, export_extras=True, export_skins=False, export_morph=False, export_materials="NONE")
    rep["export"] = list(r); rep["bytes"] = os.path.getsize(out)
    return rep

QUAIS = args[3].split(",") if len(args) > 3 else ["entrada", "gol", "perdeu"]
report = []
for nome in QUAIS:
    plan = {"entrada": plano_entrada, "gol": plano_gol, "perdeu": plano_perdeu}[nome]()
    for side in ("r", "l"): report.append(build(plan, f"{nome}_{side}.glb", side == "l"))
print("@@JSON@@" + json.dumps(report, ensure_ascii=False))
