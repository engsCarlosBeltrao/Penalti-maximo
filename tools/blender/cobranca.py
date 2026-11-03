# COBRANÇAS DE PÊNALTI — gerador paramétrico de clipes no ESQUELETO do athlete.glb (Blender 5.2, modo background).
# Cada clipe = ESTILO (rotina de aproximação) × TIPO (mecânica do chute), definidos em tools/blender/perfis_cobranca.py.
# Sai só esqueleto + clipe (o modelo não é reexportado) e um JSON com tempos, contato e poses de início/fim, lidos pelo jogo.
#
# Técnica (skills blender-core / blender-animation / blender-character-rigging), a mesma de tools/blender/chute.py (o chute médio de referência):
#  - IK de 2 ossos nas pernas (alvo = tornozelo, polo = joelho) + Copy Rotation no pé; apoios TRAVADOS no gramado (dedos presos enquanto o calcanhar sobe);
#  - perna de chute por ângulos de coxa/canela (curvas monótonas pchip) resolvidos no plano da perna; pelve, coluna, cabeça e braços por curvas;
#  - os apoios da corrida são gerados de trás para a frente a partir do plantio, então toda rotina termina exatamente na última passada do tipo;
#  - CONTATO pela geometria visível da chuteira (vértices Boots/Sole presos ao pé): o tornozelo recua na direção do golpe até a chuteira encostar
#    na superfície da bola (folga alvo -1 mm) no quadro do contato; na chapada o toque tem de ser na parte INTERNA do pé;
#  - chave em todo quadro (60 fps), bake visual (bake_action.py, self-bake), e o CANHOTO é o espelho exato da pose (delta de cada osso em relação ao
#    repouso, refletido no plano X e aplicado ao osso gêmeo) — sem escala negativa, para não espelhar nome e número da camisa no jogo.
# Uso: blender -b --factory-startup --python-exit-code 1 -P tools/blender/cobranca.py -- assets/models/athlete.glb assets/models/anim .claude/skills <estilo> <tipo>
import bpy, sys, os, json, math
from mathutils import Vector, Matrix, Quaternion

args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT_DIR, SKILLS, ESTILO, TIPO = args[0], args[1], args[2], args[3], args[4]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import perfis_cobranca as PC
import bracos as BR                                                  # braço com cotovelo-dobradiça, punho sem torção, dedos pelos eixos reais
T, PE = PC.tipo(TIPO), PC.PE[ESTILO]
E = PC.estilo(ESTILO, T)
CLIP = f"{ESTILO}_{TIPO}"
FPS = 60
BALL = Vector((0, 0, .11))
D, R2D = math.radians, math.degrees

bpy.ops.wm.read_factory_settings(use_empty=True)
assert bpy.ops.import_scene.gltf(filepath=SRC) == {"FINISHED"}
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
BOOT = {"r": [], "l": []}                                             # chuteiras VISÍVEIS (Boots/Sole), vértices presos a cada pé
for o in bpy.data.objects:
    if o.type != "MESH": continue
    gi = {g.index: g.name for g in o.vertex_groups}; mats = [m.name if m else "" for m in o.data.materials]; face_mat = {}
    for poly in o.data.polygons:
        for vi in poly.vertices: face_mat[vi] = mats[poly.material_index] if poly.material_index < len(mats) else ""
    for v in o.data.vertices:
        if face_mat.get(v.index) not in ("Boots", "Sole") or not v.groups: continue
        g = gi.get(max(v.groups, key=lambda g: g.weight).group, "")
        for s in "lr":
            if g in (f"foot_{s}", f"ball_{s}", f"ball_leaf_{s}"): BOOT[s].append((o.matrix_world @ v.co, face_mat[v.index]))
CORPO = BR.Corpo(list(bpy.data.objects), arm)                       # pele por osso (bracos.py): conferir que os dedos não entram no corpo durante a corrida e o chute
for o in [o for o in bpy.data.objects if o != arm]: bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene; sc.render.fps = FPS
vl = bpy.context.view_layer
for pb in arm.pose.bones: pb.rotation_mode = "QUATERNION"
REST = {b.name: b.matrix_local.copy() for b in arm.data.bones}
AN = REST["foot_r"].translation.z
LT = (REST["calf_r"].translation - REST["thigh_r"].translation).length
LS = (REST["foot_r"].translation - REST["calf_r"].translation).length
HIP = {s: REST[f"thigh_{s}"].translation - REST["pelvis"].translation for s in "lr"}

def pchip(keys):                                                     # interpolação cúbica monótona (Fritsch–Carlson): sem overshoot
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
            h00, h10, h01, h11 = 2*u**3 - 3*u**2 + 1, u**3 - 2*u**2 + u, -2*u**3 + 3*u**2, u**3 - u**2
            return h00*ys[i] + h10*h[i]*m[i] + h01*ys[i + 1] + h11*h[i]*m[i + 1]
        return f
    if isinstance(vs[0], (tuple, list)): fs = [scalar(ts, [v[k] for v in vs]) for k in range(len(vs[0]))]; return lambda x: tuple(f(x) for f in fs)
    return scalar(ts, vs)

def rot(yaw=0, lean=0, tilt=0):                                      # yaw em Z (- = vira para -X), lean em X (+ = para a frente), tilt em Y
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
best = None
for a in (-180, -90, 0, 90):
    for s in "lr":
        arm.pose.bones[f"calf_{s}"].constraints[0].pole_angle = D(a)
        IKT[s].matrix_world = Matrix.Translation(REST[f"foot_{s}"].translation + Vector((0, 0, .06))) @ REST[f"foot_{s}"].to_3x3().to_4x4()
        POLE[s].location = REST[f"calf_{s}"].translation + Vector((0, -.6, 0))
    vl.update(); err = sum((arm.pose.bones[f"calf_{s}"].head - REST[f"calf_{s}"].translation).length for s in "lr")
    if best is None or err < best[1]: best = (a, err)
for s in "lr": arm.pose.bones[f"calf_{s}"].constraints[0].pole_angle = D(best[0])
def foot_m(s, yaw, pitch): return rot(yaw, pitch) @ REST[f"foot_{s}"].to_3x3()
BOOT_L = {s: [(REST[f"foot_{s}"].inverted() @ p, m) for p, m in BOOT[s]] for s in "lr"}   # chuteira no referencial de repouso do osso do pé
def boot_gap(an, yaw, pitch):
    M = foot_m("r", yaw, pitch); best_ = (9, None, None)
    for lp, m in BOOT_L["r"]:
        d = (an + M @ lp - BALL).length - .11
        if d < best_[0]: best_ = (d, m, lp)
    return best_
def toe_off(s): return REST[f"ball_{s}"].translation - REST[f"foot_{s}"].translation
def ankle_at(s, pos, yaw, pitch):                                    # tornozelo de um pé chapado em pos que gira sobre os DEDOS (pitch > 0)
    flat = Vector((pos.x, pos.y, AN)); bj = flat + rot(yaw) @ toe_off(s); return bj - rot(yaw, pitch) @ toe_off(s)
V2 = lambda p: Vector((p[0], p[1], 0))

# ================= PLANEJAMENTO: apoios, de trás para a frente a partir do plantio =================
AP = E["AP"]; A, N = fwd(AP), left(AP)
PL = V2(T["PL"]); lat = T["lat"]; PLANT = T["plant"]; KICK_OFF = T["kick_off"]; tR3 = T["tR3"]; KICK_LAND = T["kick_land"]
R3 = PL - A*T["last"] - N*lat                                        # última passada (pé de chute)
HOP = E["pulinho"]
if HOP:                                                              # pulinho: R3 → LH (apoio pousa antes da bola) → salto sobre o apoio → PL
    tH = PLANT - .30; LH = PL - A*.40; tR3 = tH - .26; KICK_OFF = tH - .10
    R3 = LH - A*.78 - N*lat                                          # passada até o pouso do pulinho mais curta (o salto completa a distância)
PS = E["passos"]; n = len(PS)
feet = ["l" if (n - 1 - k) % 2 == 0 else "r" for k in range(n)]    # o apoio imediatamente antes de R3 é sempre o esquerdo
FF = [None]*n; acc_l = acc_t = 0
for k in range(n - 1, -1, -1):
    acc_l += PS[k][0]; acc_t += PS[k][1] + (E["hesita"] if k == n - 1 else 0)
    FF[k] = dict(s=feet[k], pos=R3 - A*acc_l + (N*lat if feet[k] == "l" else Vector()), tdn=tR3 - acc_t, dur=PS[k][1] + (E["hesita"] if k == n - 1 else 0))
def ponto_partida(Tt, Ee):                                           # posição parada de uma rotina (mesma conta acima, só posições)
    PL_ = V2(Tt["PL"]); R3_ = PL_ - A*Tt["last"] - N*Tt["lat"]
    if Ee["pulinho"]: R3_ = PL_ - A*.40 - A*.78 - N*Tt["lat"]
    PS_ = Ee["passos"]; n_ = len(PS_); f0 = "l" if (n_ - 1) % 2 == 0 else "r"
    return R3_ - A*sum(x[0] for x in PS_) + (N*Tt["lat"] if f0 == "l" else Vector()) - A*Ee["inicio"] - (N*Tt["lat"] if f0 == "l" else Vector())
# MESMO ponto de partida para os três tipos de um estilo (o do médio): o tipo só é conhecido quando o jogador solta a barra de força
S = ponto_partida(PC.tipo("medio"), PC.estilo(ESTILO, PC.tipo("medio")))
if (FF[0]["pos"] - S).length < .25: FF = FF[1:]; n = len(FF); feet = feet[1:]   # 1º passo minúsculo (o ponto de partida já está ali): o outro pé começa a corrida
PRIMEIRO_PASSO = (FF[0]["pos"] - S).length
SW0 = (.25 if E["gait"] < 0 else .32) + .22*max(0, PRIMEIRO_PASSO - .7)   # 1º passo mais longo → balanço mais longo
T0 = FF[0]["tdn"] - SW0 - .10
T0 = -math.ceil(-T0*FPS - 1e-6)/FPS; T1 = T["T1"]
CONTACT, END = round(-T0*FPS), round((T1 - T0)*FPS)
F = lambda tc: (tc - T0)*FPS
TC = lambda f: f/FPS + T0
# posição parada = pose de espera do jogo (rig.js, modo idle), girada para o ângulo desta rotina
ROT0 = rot(AP + 35)
R0, L0 = S + ROT0 @ Vector((-.144, .148, 0)), S + ROT0 @ Vector((.188, -.084, 0))
YAW_INI = {"r": AP - 3.0, "l": AP + 3.1}
PSL = AP*.55                                                         # pé de apoio aponta mais para o alvo que a corrida
rec = T["rec"]; R4, L5, R5 = V2(rec["R4"]), V2(rec["L5"]), V2(rec["R5"])

# apoios em ordem de tempo (pé, posição, toque, yaw)
FALLS = [(f["s"], f["pos"], f["tdn"], AP) for f in FF] + [("r", R3, tR3, AP)] + ([("l", LH, tH, AP*.8)] if HOP else []) + [("l", PL, PLANT, PSL)]
def arc_h(d): h = .10 + .16*min(1, d/1.0); return (h, .58*h)
STEPS = {"r": [], "l": []}
for s in "lr":
    mine = [x for x in FALLS if x[0] == s]; prev = (s, R0 if s == "r" else L0, -9, YAW_INI[s])
    for x in mine:
        if prev[2] == -9:                                           # sai da posição parada
            toff = x[2] - SW0 if s == FF[0]["s"] else min(FF[0]["tdn"] + E["gait"]*SW0*.6, x[2] - .16)
            toff = max(T0 + .06, toff)
        else:
            others = [o for o in FALLS if o[0] != s and o[2] > prev[2]]
            toff = (others[0][2] + E["gait"]*(others[0][2] - prev[2])) if others else x[2] - .25
            toff = max(prev[2] + .10, min(x[2] - .14, toff))
            if E["hesita"] and s == "r" and x[1] is R3: toff = tR3 - .30   # hesitação: pé direito fica no chão (duplo apoio) e só então sai para a última passada
        if HOP and s == "l" and x[1] is PL: toff = PLANT - .21; arc = (.21, .16)
        else: arc = arc_h((x[1] - prev[1]).length)
        if s == "r" and x[1] is R3:
            STEPS[s].append((toff, x[2], prev[1], x[1], x[3], arc)); prev = x; continue
        STEPS[s].append((toff, x[2], prev[1], x[1], x[3], arc)); prev = x
STEPS["r"].append((KICK_OFF, KICK_LAND, R3, R4, 0, (.3, .17)))
STEPS["r"].append((rec["r_step"][0], rec["r_step"][1], R4, R5, 0, arc_h((R5 - R4).length)))
STEPS["l"].append((rec["l_step"][0], rec["l_step"][1], PL, L5, -5, arc_h((L5 - PL).length)))

# ================= CURVAS DO CORPO =================
RELAX = lambda s: ((s*.2, 0, -1), (s*.15, -.35, -.9))
FWDA = lambda s: ((s*.10, -.50, -.86), (-s*.15, -.86, .26)); BACKA = lambda s: ((s*.18, .62, -.76), (s*.05, -.55, -.83))
def armv(s, kind, k=1.0):                                            # braço da corrida com amplitude k (k = 0 → relaxado)
    r, v = RELAX(s), (FWDA(s) if kind == "F" else BACKA(s))
    return tuple(tuple(r[i][j] + (v[i][j] - r[i][j])*k for j in range(3)) for i in range(2))
side = lambda s: 1 if s == "l" else -1
ka = E["arms"]
P_POS = {T0: tuple(S.xy) + (.93,), T0 + .20: tuple((S + A*.08).xy) + (.92,)}
P_ROT = {T0: (AP, 4, 0), T0 + .20: (AP, E["lean"]*.6, 0)}
C_ROT = {T0: (AP, 6, 0), T0 + .20: (AP, E["lean"]*.6 + 2, 0)}
ARMS = {"l": {T0: RELAX(1), T0 + .18: RELAX(1)}, "r": {T0: RELAX(-1), T0 + .18: RELAX(-1)}}
keys_ap = []
for i, f in enumerate(FF + [dict(s="r", pos=R3, tdn=tR3, dur=.3)]):
    sg = side(f["s"]); toff_k = next((e[0] for e in STEPS[f["s"]] if e[2] is f["pos"]), f["tdn"] + .2)
    if f["pos"] is R3: tk = f["tdn"] + .08
    elif E["gait"] > -.4 and not (E["hesita"] and i == n - 2): tk = (f["tdn"] + toff_k)/2                # caminhada/trote: a pelve passa sobre o pé no MEIO do apoio
    else: tk = f["tdn"] + min(.12*f["dur"], .06)                     # corrida: logo após o toque (apoio curto)
    P_POS[tk] = tuple((f["pos"] - N*.04*sg).xy) + (E["zs"],); keys_ap.append(tk)
    adj = E["ajustes"]*(1 if i % 3 == 0 else -1) if E["ajustes"] else 0
    P_ROT[tk] = (AP - sg*E["sway"]*-1 + adj*.5, E["lean"], sg*1.5 + adj) if f["pos"] is not R3 else (AP - 5, E["lean"] - 2, -2)
    C_ROT[tk] = (AP - sg*E["sway"]*1.6 - adj*.6, E["lean"] + 2, 0) if f["pos"] is not R3 else (AP + 5, E["lean"], 0)
    fwd_arm, back_arm = ("l", "r") if f["s"] == "r" else ("r", "l")
    if f["pos"] is R3:
        if HOP: ARMS["l"][tk] = armv(1, "F", ka*.8); ARMS["r"][tk] = armv(-1, "B", ka)   # sem pulinho, os braços daqui em diante vêm do tipo (pre_arms)
    else: ARMS[fwd_arm][tk] = armv(1 if fwd_arm == "l" else -1, "F", ka); ARMS[back_arm][tk] = armv(1 if back_arm == "l" else -1, "B", ka)
    if i > 0:                                                        # meio do voo/balanço entre dois apoios: pelve no ponto alto (corrida) ou baixo (caminhada)
        ta, tb = keys_ap[-2], keys_ap[-1]; pa, pb_ = Vector(P_POS[ta][:2]), Vector(P_POS[tb][:2])
        if tb - ta > .14: P_POS[(ta + tb)/2] = tuple(((pa + pb_)/2)[:]) + (E["zf"],)
if E["hesita"]:                                                     # hesitação: apoio esquerdo longo, pelve quase parada (anda ~10 cm), tronco e cabeça vivos
    fl, fr_ = FF[-1], FF[-2]; t_h0, t_h1 = fl["tdn"] + .06, tR3 - .30; mid_ = lambda w_: fr_["pos"].lerp(fl["pos"], w_) + N*.09
    for t_, a_, z_, yw_ in ((t_h0, .55, E["zs"] - .015, AP + 2), ((t_h0 + t_h1)/2, .64, E["zs"] - .02, AP - 4), (t_h1, .72, E["zs"] - .012, AP + 3)):
        P_POS[t_] = tuple(mid_(a_).xy) + (z_,); P_ROT[t_] = (yw_, E["lean"] - 3, 1); C_ROT[t_] = (yw_ + (5 if a_ == .05 else -3), E["lean"] - 2, 0)
        ARMS["l"][t_] = armv(1, "F", .35); ARMS["r"][t_] = armv(-1, "B", .35)
    for t_ in list(P_POS):
        if t_h0 < t_ < t_h1 and t_ not in (t_h0, (t_h0 + t_h1)/2, t_h1): del P_POS[t_]
# pré-plantio (da saída do pé de chute ao plantio)
rel = lambda a, n_, z: tuple((PL - A*a - N*n_).xy) + (z,)
if HOP:
    tA = PLANT - .11
    P_POS.update({tH + .02: tuple((LH - N*.03).xy) + (.875,), PLANT - .21: tuple((LH + A*.10 - N*.03).xy) + (.90,), tA: tuple(((LH + PL - A*.46)/2 - N*.02).xy) + (.975,),
                  PLANT: rel(T["pre_pel"][0][0], T["pre_pel"][0][1], .86)})
    P_ROT.update({KICK_OFF: (AP - 6, 6, 0), tH + .02: (AP - 8, 4, 0), tA: (AP - 12, -2, 4), PLANT: tuple(AP*(i == 0) + v for i, v in enumerate(T["pre_prot"][0]))})
    C_ROT.update({KICK_OFF: (AP + 6, 5, 2), tH + .02: (AP + 8, 4, 3), tA: (AP + 12, -4, 8), PLANT: tuple(AP*(i == 0) + v for i, v in enumerate(T["pre_crot"][0]))})
    ARMS["l"].update({tH + .02: armv(1, "F", .5), tA: ((.65, .15, -.45), (.65, -.25, -.1)), PLANT: T["pre_arms"]["l"][0]})
    ARMS["r"].update({tH + .02: armv(-1, "B", .6), tA: ((-.6, -.05, -.6), (-.5, -.45, -.3)), PLANT: T["pre_arms"]["r"][0]})
else:
    for dt, (a_, n_, z) in T["pre_pel"].items(): P_POS[PLANT + dt] = rel(a_, n_, z)
    for k_, v in T["pre_prot"].items(): P_ROT[KICK_OFF if k_ == "off" else PLANT + k_] = (AP + v[0], v[1], v[2])
    for k_, v in T["pre_crot"].items(): C_ROT[KICK_OFF if k_ == "off" else PLANT + k_] = (AP + v[0], v[1], v[2])
    for s in "lr":
        for dt, v in T["pre_arms"][s].items(): ARMS[s][PLANT + dt] = armv(-1, "B", ka) if v == "BACK" else v
# do plantio em diante: tabela do tipo
P_POS.update(T["pel"]); P_ROT.update(T["prot"]); C_ROT.update(T["crot"])
for s in "lr":
    for t_, v in T["arms"][s].items(): ARMS[s][t_] = RELAX(1 if s == "l" else -1) if v == "RELAX" else v
P_POS, P_ROT, C_ROT = pchip(P_POS), pchip(P_ROT), pchip(C_ROT)
# cabeça: (inclinação sobre o peito, peso do olhar no goleiro)
HK = {T0: (20, 0), PLANT: (38, 0)}
for ap_t in keys_ap[:-1]: HK.setdefault(ap_t, (26, 0))
for (a_, b_) in E["olhar"]:
    for t_ in list(HK):
        if a_ - .1 < t_ < b_ + .1: del HK[t_]
    HK[a_] = (24, 0); HK[a_ + .15] = (10, 1); HK[b_ - .15] = (10, 1); HK[b_] = (26, 0)
for t_, v in T["head"].items(): HK[t_] = (v, 0)
HEAD = pchip(HK)
ARMF = {s: pchip({t: tuple(v[0]) + tuple(v[1]) for t, v in tab.items()}) for s, tab in ARMS.items()}

def hip_pos(s, tc): (x, y, z), (yw, ln, tl) = P_POS(tc), P_ROT(tc); return Vector((x, y, z)) + rot(yw, ln, tl) @ HIP[s]
def solve2(x, y):
    d = min(math.hypot(x, y), LT + LS - 1e-4); a = math.atan2(x, y)
    k = math.acos(max(-1, min(1, (LT*LT + d*d - LS*LS)/(2*LT*d)))); th = a + k
    kx, ky = LT*math.sin(th), LT*math.cos(th); return R2D(th), R2D(math.atan2(x - kx, y - ky))
def leg_plane(psi, beta):
    f = fwd(psi); r = -left(psi); g = Vector((0, 0, -1))*math.cos(D(beta)) + r*math.sin(D(beta)); return f, g
def plane_coords(tc, P, psi, beta):
    f, g = leg_plane(psi, beta); v = P - hip_pos("r", tc); return v.dot(f), v.dot(g)

# ---------- perna de chute ----------
amp = E["amp"]
def tkey(k_): return PLANT if k_ == "plant" else (KICK_OFF if k_ == "off" else k_)
PSI = pchip({KICK_OFF: AP, **{tkey(k_): (AP + v if k_ == "plant" else v) for k_, v in T["psi"].items()}, KICK_LAND: 0})
pk = {KICK_OFF: 35, **{tkey(k_): v for k_, v in T["pitch"].items()}, KICK_LAND: -8}
if HOP: pk.update({tH: 45, tH + .08: 55, PLANT - .11: 80})
else: pk.update({PLANT + dt: v for dt, v in T["pre_pitch"].items()})
PITCH_K = pchip(pk)
FY = pchip({KICK_OFF: 0, **{tkey(k_): v for k_, v in T["footyaw"].items()}, KICK_LAND: 0}) if T["footyaw"] else (lambda tc: 0)
ct = T["contact"]
A_C = BALL + rot(PSI(0)) @ Vector(ct["off"])
lo, hi = -.08, .14
for _ in range(44):                                                  # recua o tornozelo até a chuteira apenas ENCOSTAR na bola (-1 mm)
    mid = (lo + hi)/2
    if boot_gap(A_C - fwd(PSI(0))*mid, PSI(0) + FY(0), PITCH_K(0))[0] < -.001: lo = mid
    else: hi = mid
A_C = A_C - fwd(PSI(0))*hi; CONTACT_SHIFT = hi
GAP0 = boot_gap(A_C, PSI(0) + FY(0), PITCH_K(0))
h0 = hip_pos("r", 0); vC = A_C - h0; BETA_C = R2D(math.atan2(vC.dot(-left(PSI(0))), -vC.z))
BETA = pchip({KICK_OFF: 0, **{tkey(k_): v*BETA_C for k_, v in T["beta"].items()}, KICK_LAND: 0})
TH_C, SH_C = solve2(*plane_coords(0, A_C, PSI(0), BETA(0)))
R3_OFF = ankle_at("r", R3, AP, 35)
TH_O, SH_O = solve2(*plane_coords(KICK_OFF, R3_OFF, PSI(KICK_OFF), BETA(KICK_OFF)))
ak = {KICK_OFF: (TH_O, SH_O), 0: (TH_C, SH_C)}
for k_, v in T["ang"].items():
    t_ = tkey(k_); val = (TH_C + v[1], SH_C + v[2]) if v[0] == "C" else v
    ak[t_] = (val[0]*amp, val[1]*amp) if t_ != 0 else val
if HOP: ak.update({tH: (-4*amp, -80*amp), tH + .08: (-9*amp, -92*amp), PLANT - .11: (-14*amp, -105*amp)})
else: ak.update({PLANT + dt: (v[0]*amp, v[1]*amp) for dt, v in T["pre_ang"].items()})
ANG = pchip(ak)
TIP = REST["foot_r"].inverted() @ arm.data.bones["ball_r"].tail_local   # ponta do pé no referencial do osso do pé
def kick_leg(tc):
    th, sh = ANG(tc); f, g = leg_plane(PSI(tc), BETA(tc)); h = hip_pos("r", tc)
    kn = h + f*(LT*math.sin(D(th))) + g*(LT*math.cos(D(th))); an = kn + f*(LS*math.sin(D(sh))) + g*(LS*math.cos(D(sh)))
    if tc > .05:                                                     # depois do contato a ponta da chuteira nunca desce ao gramado
        tip = an + foot_m("r", PSI(tc) + FY(tc), PITCH_K(tc)) @ TIP
        if tip.z < .012: an = an + Vector((0, 0, .012 - tip.z))
    return an, kn, PITCH_K(tc), PSI(tc) + FY(tc)

# ---------- pés fora do chute ----------
def yw_prev(s, t_off):
    yw = YAW_INI[s]
    for ev in STEPS[s]:
        if ev[1] <= t_off: yw = ev[4]
    return yw
def foot_state(s, tc):
    evs = STEPS[s]
    for (t_off, t_on, P0_, P1_, yw, (h1, h2)) in evs:
        if t_off <= tc <= t_on:
            u = (tc - t_off)/(t_on - t_off)
            path = pchip({0: tuple(ankle_at(s, P0_, yw_prev(s, t_off), 35)), .35: tuple(P0_.lerp(P1_, .22) + Vector((0, 0, h1))),
                          .75: tuple(P0_.lerp(P1_, .78) + Vector((0, 0, h2))), 1: tuple(P1_ + Vector((0, 0, AN + .02)))})
            y0 = yw_prev(s, t_off); uu = min(1, u/.6); ys = y0 + (yw - y0)*uu*uu*(3 - 2*uu)
            kp = min(1, h1/.30)**1.5                                        # passo baixo (arco curto) → pé menos inclinado, os dedos não descem ao gramado
            return Vector(path(u)), pchip({0: 35, .35: 60*kp, .75: -5*kp, 1: -12})(u), ys, False
    pos, yw, t_on_last, t_next_off = (R0 if s == "r" else L0), YAW_INI[s], -9, 9
    for ev in evs:
        if tc >= ev[1]: pos, yw, t_on_last = ev[3], ev[4], ev[1]
        if ev[0] > tc: t_next_off = min(t_next_off, ev[0])
    k_on = min(1, (tc - t_on_last)/.05) if t_on_last > -9 else 1
    k_off = max(0, 1 - (t_next_off - tc)/.07) if t_next_off < 9 else 0
    pitch = -12*(1 - k_on) + 35*k_off**2
    an = ankle_at(s, pos, yw, pitch) if pitch > 0 else Vector((pos.x, pos.y, AN + .02*(1 - k_on)))
    return an, pitch, yw, True
def toe_flat_w(s, tc):
    offs = [e[0] for e in STEPS[s] if e[0] <= tc]
    return max(0, 1 - (tc - max(offs))/.10) if offs else 0

# ---------- alcance: na aproximação a perna de apoio nunca pode ficar esticada além do comprimento (senão o IK arrasta o pé) ----------
LMAX = LT + LS - .008
DZ = [0.0]*(END + 1)
for f in range(END + 1):
    tc = TC(f)
    if tc > KICK_OFF - .03: continue
    for s in "lr":
        an, _, _, ground = foot_state(s, tc)
        if not ground: continue
        h = hip_pos(s, tc); dxy = (h - an).xy.length
        allowed = an.z + math.sqrt(max(0, LMAX*LMAX - dxy*dxy)); DZ[f] = min(DZ[f], allowed - h.z)
for _ in range(2):                                                   # mínimo e média móveis: a correção entra e sai devagar (sem pulos)
    DZ = [min(DZ[max(0, i - 6):i + 7]) for i in range(END + 1)]
    DZ = [sum(DZ[max(0, i - 6):i + 7])/len(DZ[max(0, i - 6):i + 7]) for i in range(END + 1)]
_PP = P_POS
def P_POS(tc):
    x, y, z = _PP(tc); fi = max(0, min(END, (tc - T0)*FPS)); i0 = int(fi); i1 = min(END, i0 + 1); w = fi - i0
    return (x, y, z + DZ[i0]*(1 - w) + DZ[i1]*w)
ALCANCE_MAX_CM = [round(-min(DZ)*100, 1), round(TC(min(range(END + 1), key=lambda i: DZ[i])), 3)]

# ================= QUADROS-CHAVE =================
sc.frame_start, sc.frame_end = 0, END
TOES = []
for f in range(0, END + 1):
    tc = TC(f); sc.frame_set(f)
    (x, y, z), (yw, ln, tl), ch = P_POS(tc), P_ROT(tc), C_ROT(tc)
    Rp, Rc = rot(yw, ln, tl), rot(*ch)
    set_rot("pelvis", Rp, Vector((x, y, z))); key("pelvis", f, loc=True)
    qp, qc = Rp.to_quaternion(), Rc.to_quaternion()
    for i, b in enumerate(("spine_01", "spine_02", "spine_03")): set_rot(b, qp.slerp(qc, (i + 1)/3).to_matrix()); key(b, f)
    hp_, hw = HEAD(tc); Rh = Matrix.Rotation(D(-ch[0]*.85*hw), 3, "Z") @ Rc @ Matrix.Rotation(D(hp_), 3, "X")   # olhar: a cabeça gira para o gol
    set_rot("neck_01", qc.slerp(Rh.to_quaternion(), .5).to_matrix()); key("neck_01", f); set_rot("Head", Rh); key("Head", f)
    for s in "lr":
        v = ARMF[s](tc); Ru, Rf = BR.arm_world(REST, s, Rc @ Vector(v[:3]), Rc @ Vector(v[3:]), Rc @ BR.FWD0)
        set_rot(f"upperarm_{s}", Ru); key(f"upperarm_{s}", f); set_rot(f"lowerarm_{s}", Rf); key(f"lowerarm_{s}", f)
    for s in "lr":
        if s == "r" and KICK_OFF < tc < KICK_LAND:
            an, kn, pitch, fy = kick_leg(tc); w = min(1, (tc - KICK_OFF)/.05, (KICK_LAND - tc)/.06)
            if w < 1:
                an0, p0, y0, _ = foot_state("r", KICK_OFF if tc - KICK_OFF < .05 else KICK_LAND)
                an = an0.lerp(an, w); pitch = p0 + (pitch - p0)*w; fy = y0 + (fy - y0)*w
            hp = hip_pos("r", tc); pole = kn + (kn - (hp + an)/2).normalized()*.6
            if ct["kind"] == "chapa": pole = pole + (-left(PSI(tc)))*.9*min(1, abs(FY(tc))/80)   # rotação externa do quadril: joelho para fora
        else:
            an, pitch, fy, _ = foot_state(s, tc); hp = hip_pos(s, tc)
            pole = hp + fwd(P_ROT(tc)[0])*.8 + Vector((0, 0, -.4))
        IKT[s].matrix_world = Matrix.Translation(an) @ foot_m(s, fy, pitch).to_4x4()
        IKT[s].keyframe_insert("location", frame=f); IKT[s].keyframe_insert("rotation_quaternion", frame=f)
        POLE[s].location = pole; POLE[s].keyframe_insert("location", frame=f)
    TOES.append((f, tc, {s: (foot_state(s, tc) if not (s == "r" and KICK_OFF < tc < KICK_LAND) else (None, 0, 0, False)) for s in "lr"}))
IK_ERR = {"l": [0, 0], "r": [0, 0]}
for f, tc, st in TOES:
    sc.frame_set(f); vl.update()
    for s in "lr":
        an, pitch, fy, ground = st[s]; pb = arm.pose.bones[f"ball_{s}"]
        if ground: e = (pb.parent.head - an).length; IK_ERR[s] = max(IK_ERR[s], [round(e, 4), f])
        w = 1 if ground and pitch > 0 else toe_flat_w(s, tc)
        pb.rotation_quaternion = (1, 0, 0, 0)
        if w > 0:
            set_rot(f"ball_{s}", rot(yw_prev(s, tc + 1e-3) if not ground else fy)); q = pb.rotation_quaternion.copy()
            pb.rotation_quaternion = Quaternion((1, 0, 0, 0)).slerp(q, w)
        key(f"ball_{s}", f)
for f in (0, END):                                                   # mão relaxada (bracos.py: cada falange no seu eixo; polegar atravessa a palma)
    for s in "lr":
        for nm, q in BR.finger_quats(REST, s, "relaxada").items(): pb = arm.pose.bones[nm]; pb.rotation_quaternion = q; pb.keyframe_insert("rotation_quaternion", frame=f, group=nm)
act = arm.animation_data.action; act.name = "Chute"; act.use_fake_user = True

sys.path.insert(0, os.path.join(SKILLS, "blender-animation", "scripts")); import bake_action
baked = bake_action.run(source=arm.name, target=arm.name, actions=["Chute"], clean=False)
for o in [o for o in bpy.data.objects if o != arm]: bpy.data.objects.remove(o, do_unlink=True)
for pb in arm.pose.bones:
    for c in list(pb.constraints): pb.constraints.remove(c)
ANTICOL = BR.anticolisao(arm, REST, CORPO, range(0, END + 1), sc, vl)   # dedos fora do corpo (coxas na corrida e no chute): punho empurrado, suavizado

# ================= VERIFICAÇÃO (antes do espelho; o canhoto é conferido de novo depois) =================
JOINTS = ["pelvis", "Head", "hand_l", "hand_r", "foot_l", "foot_r", "ball_l", "ball_r", "calf_l", "calf_r", "thigh_r"]
def trajetoria():
    out = []
    for f in range(0, END + 1):
        sc.frame_set(f); vl.update(); pb = arm.pose.bones
        out.append({j: pb[j].head.copy() for j in JOINTS} | {"toe_l": pb["ball_l"].tail.copy(), "toe_r": pb["ball_r"].tail.copy()})
    return out
traj = trajetoria()
vel = lambda j, i: (traj[i][j] - traj[i - 1][j]).length*FPS
def drift(j, t_a, t_b):
    fa, fb = max(0, math.ceil(F(t_a) - 1e-6)), min(END, math.floor(F(t_b) + 1e-6))   # só quadros DENTRO do apoio (o de saída já é balanço)
    return 0 if fb <= fa else max((traj[i][j] - traj[fa][j]).xy.length for i in range(fa, fb + 1))
apoios = []                                                          # cada fase de apoio: do toque (+0,06 s) até a saída — a articulação dos dedos não pode andar
for s in "lr":
    evs = STEPS[s]; ons = [(-9, R0 if s == "r" else L0)] + [(e[1], e[3]) for e in evs]
    for i, (t_on, _) in enumerate(ons):
        offs = [e[0] for e in evs if e[0] > t_on]; t_off = min(offs) if offs else T1
        apoios.append((s, round(max(T0, t_on + .06), 3), round(t_off, 3), round(drift(f"ball_{s}", max(T0, t_on + .06), t_off)*1000, 1)))
toe_v = [vel("toe_r", i) for i in range(1, END + 1)]
peak = 1 + max(range(len(toe_v)), key=lambda i: toe_v[i])
lowz = lambda tr: min(tr["toe_l"].z, tr["toe_r"].z, tr["ball_l"].z, tr["ball_r"].z)
lowf = min(range(END + 1), key=lambda i: lowz(traj[i]))
def accs(j): a = [((traj[i + 1][j] - traj[i][j]) - (traj[i][j] - traj[i - 1][j])).length*FPS*FPS for i in range(1, END)]; k = max(range(len(a)), key=lambda i: a[i]); return [round(a[k], 1), round(TC(k + 1), 3)]
def boot_gap_frame(f, s="r", ball=BALL):
    sc.frame_set(f); vl.update(); M = arm.pose.bones[f"foot_{s}"].matrix; b_ = (9, None, None, None)
    for lp, m in BOOT_L[s]:
        p = M @ lp; d = (p - ball).length - .11
        if d < b_[0]: b_ = (d, m, p, lp)
    return b_
g0 = boot_gap_frame(CONTACT)
def knee_ang(i): tr = traj[i]; return round(R2D((tr["calf_r"] - tr["thigh_r"]).angle(tr["foot_r"] - tr["calf_r"])), 1)
def fim():
    last = traj[END]; mid = (last["foot_l"] + last["foot_r"])/2
    still = [i for i in range(CONTACT, END + 1) if all(vel("pelvis", k) < .02 for k in range(i, END + 1))]
    return {"vel_pelve_ultimo_quadro_m_s": round(vel("pelvis", END), 3), "pelve_parada_desde_tc": round(TC(min(still)), 3) if still else None,
            "pelve_menos_meio_dos_pes_m": [round(c, 3) for c in (last["pelvis"] - mid).xy], "base_pes_m": round((last["foot_l"] - last["foot_r"]).xy.length, 3)}
report = {"clipe": CLIP, "pe": PE, "fps": FPS, "t0": T0, "t1": T1, "frames": END + 1, "contact_frame": CONTACT,
          "contato": {"chuteira_bola_mm": round(g0[0]*1000, 1), "material": g0[1], "ponto_local_pe": [round(c, 3) for c in g0[3]], "quadro_antes_mm": round(boot_gap_frame(CONTACT - 1)[0]*1000, 1),
                      "menor_antes_mm": round(min(boot_gap_frame(f)[0] for f in range(round(F(KICK_OFF)), CONTACT))*1000, 1), "recuo_tornozelo_m": round(CONTACT_SHIFT, 4), "tecnica": ct["kind"]},
          "vel_ponta_pe": {"pico_quadro_rel": peak - CONTACT, "pico_m_s": round(max(toe_v), 1), "no_contato_m_s": round(toe_v[CONTACT - 1], 1)},
          "joelho_chute_graus": {"max_recuo": max(knee_ang(i) for i in range(round(F(KICK_OFF)), CONTACT)), "contato": knee_ang(CONTACT)},
          "apoios_deriva_mm": apoios, "max_deriva_apoio_mm": max(a[3] for a in apoios), "erro_ik_apoio": IK_ERR, "fim": fim(),
          "torcao_max_graus": BR.max_twist(arm, REST, range(0, END + 1, 3), sc, vl), "anticolisao": ANTICOL, "dedos_pele_min_mm": round(min(BR.colisao_mao(arm, CORPO, s_)[0] for f_ in range(0, END + 1, 2) for s_ in "lr" if not sc.frame_set(f_) and not vl.update())*1000, 1), "pe_mais_baixo_z_m": round(lowz(traj[lowf]), 3), "pe_mais_baixo_tc": round(TC(lowf), 3), "pe_mais_baixo_qual": min(("toe_l", "toe_r", "ball_l", "ball_r"), key=lambda j: traj[lowf][j].z), "aceleracao_max_m_s2": {j: accs(j) for j in ("pelvis", "Head", "hand_l", "hand_r", "calf_l", "calf_r")},
          "passos_aproximacao": len(FF) + 1, "primeiro_passo_m": round(PRIMEIRO_PASSO, 3), "pelve_abaixada_alcance_cm": ALCANCE_MAX_CM, "distancia_inicio_bola_m": round(S.length, 2), "duracao_aproximacao_s": round(-T0, 3)}
if HOP:
    zs_ = [traj[i]["pelvis"].z for i in range(round(F(tH)), round(F(PLANT)) + 1)]
    bz = REST["ball_r"].translation.z + .02; ar = [i for i in range(round(F(tH)), round(F(PLANT)) + 1) if min(traj[i]["ball_l"].z, traj[i]["ball_r"].z) > bz]
    report["pulinho"] = {"subida_pelve_m": round(max(zs_) - zs_[0], 3), "dois_pes_no_ar_s": round(len(ar)/FPS, 3)}
if E["hesita"]:
    a_, b_ = round(F(FF[-1]["tdn"] + .06)), round(F(tR3 - .30))
    report["hesitacao"] = {"duracao_s": round((b_ - a_)/FPS, 3), "vel_media_pelve_m_s": round((traj[b_]["pelvis"] - traj[a_]["pelvis"]).xy.length/((b_ - a_)/FPS), 3)}

# ================= CANHOTO: espelho exato da pose (osso a osso) =================
def espelhar():
    S_ = Matrix.Diagonal((-1, 1, 1, 1)); pbs = list(arm.pose.bones)
    twin = lambda n_: n_[:-2] + ("_r" if n_.endswith("_l") else "_l") if n_[-2:] in ("_l", "_r") else n_
    RM = {b.name: b.bone.matrix_local.copy() for b in pbs}; par = {b.name: (b.parent.name if b.parent else None) for b in pbs}
    frames = []
    for f in range(0, END + 1):
        sc.frame_set(f); vl.update(); frames.append({b.name: b.matrix.copy() for b in pbs})
    prevq = {}
    for f, Ms in enumerate(frames):
        new = {nm: (S_ @ (Ms[twin(nm)] @ RM[twin(nm)].inverted()) @ S_) @ RM[nm] for nm in Ms}
        for b in pbs:
            nm = b.name; p = par[nm]
            local = (new[p].inverted() @ new[nm]) if p else new[nm]
            restrel = (RM[p].inverted() @ RM[nm]) if p else RM[nm]
            basis = restrel.inverted() @ local; loc, q, _ = basis.decompose()
            if nm in prevq and prevq[nm].dot(q) < 0: q = -q
            prevq[nm] = q; b.location = loc; b.rotation_quaternion = q
            b.keyframe_insert("location", frame=f, group=nm); b.keyframe_insert("rotation_quaternion", frame=f, group=nm)
if PE == "l":
    espelhar()
    sc.frame_set(CONTACT); vl.update()
    gL = boot_gap_frame(CONTACT, "l")
    report["contato_canhoto"] = {"chuteira_bola_mm": round(gL[0]*1000, 1), "quadro_antes_mm": round(boot_gap_frame(CONTACT - 1, "l")[0]*1000, 1)}
    TOQUE = gL[2]
    traj = trajetoria(); report["canhoto_deriva_apoio_plantio_mm"] = round(drift("ball_r", PLANT + .06, .10)*1000, 1)
else:
    TOQUE = g0[2]

# ---------- exportação: só esqueleto + clipe; e o JSON com os dados para o jogo ----------
glt = lambda v: [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]          # Blender → glTF (y para cima)
arm["chute_contato_s"] = CONTACT/FPS; arm["chute_fps"] = FPS; arm["chute_inicio_tc"] = T0; arm["chute_fim_tc"] = T1; arm["bola"] = [0.0, .11, 0.0]; arm["chute_toque"] = glt(TOQUE)
arm["chute_id"] = CLIP; arm["chute_pe"] = PE
sc.frame_set(0)
for o in bpy.data.objects: o.select_set(o == arm)
vl.objects.active = arm
os.makedirs(os.path.abspath(OUT_DIR), exist_ok=True)
out_glb = os.path.join(os.path.abspath(OUT_DIR), f"cobranca_{CLIP}.glb")
r = bpy.ops.export_scene.gltf(filepath=out_glb, export_format="GLB", use_selection=True, export_animations=True, export_animation_mode="ACTIONS",
                              export_force_sampling=True, export_extras=True, export_skins=False, export_morph=False, export_materials="NONE")
lastt = traj[END]
meta = {"id": CLIP, "estilo": ESTILO, "tipo": TIPO, "pe": PE, "arquivo": f"cobranca_{CLIP}.glb", "t0": T0, "t1": T1, "contato_s": CONTACT/FPS, "fps": FPS,
        "toque": glt(TOQUE), "plantio": round(PLANT, 4), "pouso": round(KICK_LAND, 4), "inicio": {"S": [round(S.x, 4), round(S.y, 4)], "AP": AP},
        # fim, no espaço do destro (o jogo espelha para o canhoto): pelve, pé de apoio, pé de chute
        "fim": {"pelve": [round(P_POS(T1)[0], 4), round(P_POS(T1)[1], 4)], "apoio": [round(L5.x, 4), round(L5.y, 4)], "chute": [round(R5.x, 4), round(R5.y, 4)]},
        "vel_pe_contato_m_s": report["vel_ponta_pe"]["no_contato_m_s"], "relatorio": report}
with open(os.path.join(os.path.abspath(OUT_DIR), f"cobranca_{CLIP}.json"), "w", encoding="utf-8") as fh: json.dump(meta, fh, ensure_ascii=False, indent=1)
report["export"] = list(r); report["bytes"] = os.path.getsize(out_glb)
print("@@JSON@@" + json.dumps(report, ensure_ascii=False))
