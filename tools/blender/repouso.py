# REPOUSO do cobrador (esperando para bater) + pose PRONTO (preparação), no ESQUELETO do athlete.glb — Blender 5.2, modo background.
# Sai só esqueleto + o clipe "Repouso" (laço de LOOP s). A preparação ("carregando") é a transição do repouso para o 1º quadro do clipe da cobrança,
# que é o mesmo para os três tipos de um estilo (tools/blender/cobranca.py usa o mesmo ponto de partida e a mesma pose inicial).
# O clipe é feito no referencial do corpo (pelve na origem, de frente para -Y); o jogo o coloca no ponto de partida da cobrança (js/kicks.js → clipStart).
#
# Movimentos (todos periódicos no laço, com fases diferentes para não parecer mecânico):
#  - respiração (coluna e clavículas) a cada LOOP/2; transferência de peso lateral (pelve + inclinação) a cada LOOP, a perna descarregada flexiona o joelho;
#  - quadril e ombros com pequenos giros; cabeça alterna olhar a bola (mais baixa) e o gol (mais alta, um pouco virada);
#  - braços soltos com cotovelo levemente flexionado; por ~2,6 s a mão (direita no destro) vai à cintura por IK — cotovelo para fora e para trás,
#    mão sobre a crista ilíaca com a palma voltada ao corpo — e volta; punhos e antebraços com pequenos ajustes; dedos levemente curvados (mão relaxada).
#  - pés TRAVADOS por IK nas mesmas posições da pose de espera/início das cobranças (tools/blender/cobranca.py) — nada desliza.
# Uso: blender -b --factory-startup --python-exit-code 1 -P tools/blender/repouso.py -- assets/models/athlete.glb assets/models/anim .claude/skills
import bpy, sys, os, json, math
from mathutils import Vector, Matrix, Quaternion
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import bracos as BR   # braço com cotovelo-dobradiça, punho sem torção, dedos pelos eixos reais

args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT_DIR, SKILLS = args[0], args[1], args[2]
FPS, LOOP = 30, 6.4
NL = round(LOOP*FPS)                                                 # quadros do laço (o último = o primeiro)
D, R2D, TAU = math.radians, math.degrees, 2*math.pi

def build(mirror):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    assert bpy.ops.import_scene.gltf(filepath=SRC) == {"FINISHED"}
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    CORPO = BR.Corpo(list(bpy.data.objects), arm)   # pele por osso: dedos não entram no quadril nem na coxa
    for o in [o for o in bpy.data.objects if o != arm]: bpy.data.objects.remove(o, do_unlink=True)
    sc = bpy.context.scene; sc.render.fps = FPS; vl = bpy.context.view_layer
    for pb in arm.pose.bones: pb.rotation_mode = "QUATERNION"
    REST = {b.name: b.matrix_local.copy() for b in arm.data.bones}
    AN = REST["foot_r"].translation.z
    rot = lambda yaw=0, lean=0, tilt=0: Matrix.Rotation(D(yaw), 3, "Z") @ Matrix.Rotation(D(lean), 3, "X") @ Matrix.Rotation(D(tilt), 3, "Y")
    def set_rot(name, R, loc=None):
        vl.update(); pb = arm.pose.bones[name]; M = (R @ REST[name].to_3x3()).to_4x4(); M.translation = loc if loc is not None else pb.head.copy(); pb.matrix = M
    def aim(name, d):
        y = REST[name].to_3x3().col[1].normalized(); set_rot(name, y.rotation_difference(Vector(d).normalized()).to_matrix())
    PREV = {}
    def key(name, f, loc=False):
        pb = arm.pose.bones[name]; q = pb.rotation_quaternion
        if name in PREV and PREV[name].dot(q) < 0: pb.rotation_quaternion = -q
        PREV[name] = pb.rotation_quaternion.copy(); pb.keyframe_insert("rotation_quaternion", frame=f, group=name)
        if loc: pb.keyframe_insert("location", frame=f, group=name)
    def empty(n):
        e = bpy.data.objects.new(n, None); sc.collection.objects.link(e); e.rotation_mode = "QUATERNION"; return e
    # IK: pernas (pés travados) e braços (mão na cintura, com influência animada)
    IKT = {s: empty(f"IK_pe_{s}") for s in "lr"}; POLE = {s: empty(f"Polo_joelho_{s}") for s in "lr"}
    HT = {s: empty(f"IK_mao_{s}") for s in "lr"}; EP = {s: empty(f"Polo_cotovelo_{s}") for s in "lr"}
    for s in "lr":
        c = arm.pose.bones[f"calf_{s}"].constraints.new("IK"); c.target = IKT[s]; c.pole_target = POLE[s]; c.chain_count = 2
        arm.pose.bones[f"foot_{s}"].constraints.new("COPY_ROTATION").target = IKT[s]
    best = None                                                      # ângulo de polo do joelho (o mesmo procedimento de cobranca.py)
    for a in (-180, -90, 0, 90):
        for s in "lr":
            arm.pose.bones[f"calf_{s}"].constraints[0].pole_angle = D(a)
            IKT[s].matrix_world = Matrix.Translation(REST[f"foot_{s}"].translation + Vector((0, 0, .06))) @ REST[f"foot_{s}"].to_3x3().to_4x4()
            POLE[s].location = REST[f"calf_{s}"].translation + Vector((0, -.6, 0))
        vl.update(); err = sum((arm.pose.bones[f"calf_{s}"].head - REST[f"calf_{s}"].translation).length for s in "lr")
        if best is None or err < best[1]: best = (a, err)
    for s in "lr": arm.pose.bones[f"calf_{s}"].constraints[0].pole_angle = D(best[0])
    LU = (REST["lowerarm_r"].translation - REST["upperarm_r"].translation).length; LF = (REST["hand_r"].translation - REST["lowerarm_r"].translation).length
    def arm_ik(Sv, Wv, pole):                                        # IK analítico de 2 ossos: cotovelo no plano ombro–punho–polo (determinístico)
        d = Wv - Sv; L_ = min(d.length, LU + LF - 1e-3); n = d.normalized(); a_ = (LU*LU - LF*LF + L_*L_)/(2*L_); h_ = math.sqrt(max(0, LU*LU - a_*a_))
        p_ = pole - Sv; p_ = (p_ - n*p_.dot(n)).normalized(); E_ = Sv + n*a_ + p_*h_; return E_, Sv + n*L_
    foot_m = lambda s, yaw: rot(yaw) @ REST[f"foot_{s}"].to_3x3()
    # pés: os mesmos da espera do jogo / início das cobranças, no referencial do corpo (AP = -35 → girar 35°)
    R0, L0 = rot(35) @ Vector((-.144, .148, 0)), rot(35) @ Vector((.188, -.084, 0))
    FEET = {"r": (R0, -3.0), "l": (L0, 3.1)}
    FINGERS = [f"{d}_0{i}_{s}" for s in "lr" for d in ("index", "middle", "ring", "pinky") for i in (1, 2, 3)]
    THUMB = [f"thumb_0{i}_{s}" for s in "lr" for i in (1, 2, 3)]
    READY = [False]
    def curl(f, k=1.0):                                              # dedos relaxados (bracos.py: cada falange no seu eixo; polegar atravessa a palma)
        for s in "lr":
            hw_ = hip_w(f/FPS) if s == hand_side and not READY[0] else 0       # mão no quadril: polegar contorna a cintura (pose "cintura" de bracos.py)
            for nm, q in BR.finger_quats(REST, s, "cintura" if hw_ > 0 else "relaxada", hw_ if hw_ > 0 else 1).items(): arm.pose.bones[nm].rotation_quaternion = q; key(nm, f)
    RELAX = lambda s: ((s*.2, 0, -1), (s*.15, -.35, -.9))            # = braço do 1º quadro das cobranças
    HANG = lambda s: ((s*.13, -.04, -1), (s*.10, -.30, -.95))        # solto, cotovelo ~17°
    sm = lambda u: (lambda v: v*v*(3 - 2*v))(min(1, max(0, u)))
    hand_side = "r"                                                  # destro: mão direita na cintura (o canhoto sai espelhado)
    def hip_w(t):                                                    # peso da mão na cintura ao longo do laço (0 no início/fim: emenda com a pose Pronto)
        return sm((t - 1.4)/.9) * (1 - sm((t - 4.0)/.9))
    PUSHR = {s: [Vector()]*(NL + 1) for s in "lr"}                 # empurrão anticolisão do punho, por quadro (medido, suavizado no laço e aplicado)
    def pose(t, f, ready=False):
        w, br, ph = TAU*t/LOOP, math.sin(TAU*2*t/LOOP), lambda k, p: math.sin(TAU*k*t/LOOP + p)
        if ready: px, py, pz, (pyw, pln, ptl), (cyw, cln, ctl), hp, hy = 0, 0, .93, (0, 4, 0), (0, 6, 0), 20, 0
        else:
            sh = ph(1, .3)                                           # transferência de peso: + = sobre a perna esquerda
            px, py, pz = .022*sh, .006*ph(2, 1.1), .926 - .006*abs(sh) + .002*br
            pyw, pln, ptl = 1.8*ph(1, 1.9), 3.2 + .6*ph(2, .4), 2.6*sh
            cyw, cln, ctl = -1.4*ph(1, 2.4) + .8*ph(3, .2), 5.0 + .9*br, -1.2*sh
            look = sm((ph(1, -1.2) + .2)/.9)                         # 0 = olha a bola, 1 = olha o gol
            hp, hy = 22 - 13*look + 1.2*ph(3, .7), 7*look*ph(1, .5) + 2*ph(2, 2.1)
        Rp, Rc = rot(pyw, pln, ptl), rot(cyw, cln, ctl)
        set_rot("pelvis", Rp, Vector((px, py, pz))); key("pelvis", f, loc=True)
        qp, qc = Rp.to_quaternion(), Rc.to_quaternion()
        for i, b in enumerate(("spine_01", "spine_02", "spine_03")): set_rot(b, qp.slerp(qc, (i + 1)/3).to_matrix()); key(b, f)
        Rh = Matrix.Rotation(D(hy), 3, "Z") @ Rc @ Matrix.Rotation(D(hp), 3, "X")
        set_rot("neck_01", qc.slerp(Rh.to_quaternion(), .5).to_matrix()); key("neck_01", f); set_rot("Head", Rh); key("Head", f)
        for s in "lr":                                               # clavículas: ombros sobem e descem com a respiração
            sg = 1 if s == "l" else -1; set_rot(f"clavicle_{s}", Rc @ Matrix.Rotation(D(0 if ready else 1.1*br*sg), 3, "Y")); key(f"clavicle_{s}", f)
        for s in "lr":
            sg = 1 if s == "l" else -1; v = RELAX(sg) if ready else HANG(sg)
            sw = 0 if ready else 2.2*ph(1, 1.0 + (0 if s == "l" else 2.0))   # pequeno balanço do braço solto
            ua = Rc @ (Matrix.Rotation(D(sw), 3, "X") @ Vector(v[0])); fa = Rc @ (Matrix.Rotation(D(sw*1.6 + (0 if ready else 2.5*ph(3, .9 + sg))), 3, "X") @ Vector(v[1]))
            hw = 0 if ready or s != hand_side else hip_w(t)
            if hw > 0:                                               # mão na cintura: punho na linha do cinto sobre a crista ilíaca; cotovelo para FORA e um pouco para trás
                vl.update(); Sv = arm.pose.bones[f"upperarm_{s}"].head.copy()
                W_ = Vector((px, py, pz)) + Rp @ Vector((sg*.20, -.01, .14)); E_, W2 = arm_ik(Sv, W_, Vector((px, py, pz)) + Rp @ Vector((sg*.8, .25, .30)))   # cintura: meia-largura 0,16 m
                ua = ua.normalized().lerp((E_ - Sv).normalized(), hw); fa = fa.normalized().lerp((W2 - E_).normalized(), hw)
            psh = PUSHR[s][f] if not ready and f < len(PUSHR[s]) else Vector()
            if psh.length > 1e-6:                                    # encostando no corpo: o punho final é empurrado para fora (cotovelo no mesmo plano)
                vl.update(); Sv = arm.pose.bones[f"upperarm_{s}"].head.copy(); E0 = Sv + ua.normalized()*LU; W0 = E0 + fa.normalized()*LF
                E_, W2 = arm_ik(Sv, W0 + psh, E0 + (E0 - (Sv + W0)/2)*2); ua, fa = E_ - Sv, W2 - E_
            Ru, Rf = BR.arm_world(REST, s, ua, fa, Rc @ BR.FWD0)        # cotovelo-dobradiça: nenhuma torção arbitrária entre braço e antebraço
            set_rot(f"upperarm_{s}", Ru); key(f"upperarm_{s}", f); set_rot(f"lowerarm_{s}", Rf); key(f"lowerarm_{s}", f)
        for s in "lr":
            an, yw = FEET[s]; IKT[s].matrix_world = Matrix.Translation(Vector((an.x, an.y, AN))) @ foot_m(s, yw).to_4x4()
            IKT[s].keyframe_insert("location", frame=f); IKT[s].keyframe_insert("rotation_quaternion", frame=f)
            hp_ = Vector((px, py, pz)); POLE[s].location = hp_ + rot(pyw) @ Vector((0, -.8, -.4)); POLE[s].keyframe_insert("location", frame=f)
        return hip_w(t) if not ready else 0
    def hands(t, f, ready=False):                                    # 2º passe (com o IK do braço já resolvido): punho e dedos
        sc.frame_set(f); vl.update()
        for s in "lr":
            sg = 1 if s == "l" else -1; hw = 0 if ready or s != hand_side else hip_w(t)
            pb = arm.pose.bones[f"hand_{s}"]; pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
            if not ready: pb.rotation_quaternion = Quaternion(Vector((1, 0, 0)), D(4*math.sin(TAU*3*t/LOOP + sg))) @ Quaternion(Vector((0, 0, 1)), D(3*math.sin(TAU*2*t/LOOP + 1.7*sg)))
            if hw > 0:                                               # mão na cintura: o punho só DOBRA para os dedos irem para baixo/à frente sobre o quadril (sem girar)
                vl.update(); Rf = pb.parent.matrix.to_3x3() @ REST[f"lowerarm_{s}"].to_3x3().inverted()
                Rp_ = arm.pose.bones["pelvis"].matrix.to_3x3() @ REST["pelvis"].to_3x3().inverted(); f1 = Rp_ @ Vector((-sg*.25, -.85, -.45))   # dedos à frente e para baixo, contornando o quadril
                Hw = BR.hand_world(REST, s, Rf, f1); restrel = REST[f"lowerarm_{s}"].to_3x3().inverted() @ REST[f"hand_{s}"].to_3x3()
                target_local = (restrel.inverted() @ (Rf @ REST[f"lowerarm_{s}"].to_3x3()).inverted() @ Hw @ REST[f"hand_{s}"].to_3x3()).to_quaternion()
                pb.rotation_quaternion = pb.rotation_quaternion.slerp(target_local, hw)
            key(f"hand_{s}", f)
        curl(f, .75 if ready else 1.0)
    # ---- Repouso (laço) ----
    sc.frame_start, sc.frame_end = 0, NL
    for f in range(NL + 1): sc.frame_set(f); pose(f/FPS, f)
    for f in range(NL + 1): hands(f/FPS, f)
    # COLISÃO (bracos.py → Corpo): se uma junta de dedo fica a menos de 1 cm da pele, o punho é empurrado para fora pela normal. O empurrão é medido
    # em todos os quadros, suavizado no tempo (o maior numa janela de ±2 quadros, depois média circular de ±5: sem salto e o laço continua sem emenda)
    # e o laço é refeito; repete até nenhum ponto ficar dentro do corpo.
    for ciclo in range(0 if os.environ.get("REP_NOCOL") else 6):
        R_ = {s: [Vector()]*NL for s in "lr"}; pior = 1.0
        for f in range(NL):
            sc.frame_set(f); vl.update()
            for s in "lr":
                d_, n_, _ = BR.colisao_mao(arm, CORPO, s); pior = min(pior, d_)
                if d_ < BR.MARGEM: R_[s][f] = n_*(BR.MARGEM - d_ + .004)
        if pior >= BR.MARGEM - .002: break
        for s in "lr":
            D_ = [max((R_[s][(i + k) % NL] for k in range(-2, 3)), key=lambda v: v.length) for i in range(NL)]
            A_ = [sum((D_[(i + k) % NL] for k in range(-5, 6)), Vector())/11 for i in range(NL)]
            P_ = [PUSHR[s][i] + A_[i] for i in range(NL)]; PUSHR[s] = [v if v.length <= .15 else v*(.15/v.length) for v in P_] + [None]; PUSHR[s][NL] = PUSHR[s][0]
        for f in range(NL + 1): sc.frame_set(f); pose(f/FPS, f)
        for f in range(NL + 1): hands(f/FPS, f)
    CICLOS = ciclo if not os.environ.get("REP_NOCOL") else 0
    if os.environ.get("REP_PERFIL"):
        print("@@PERFIL@@", " ".join(f"{f/FPS:.1f}:{BR.colisao_mao(arm, CORPO, 'r')[0]*1000:.0f}{BR.colisao_mao(arm, CORPO, 'r')[2][:3] if BR.colisao_mao(arm, CORPO, 'r')[2] else ''}" for f in range(0, NL + 1, 6) if not sc.frame_set(f) and not vl.update()))
    PELE, PELE_ONDE = min(((lambda r: (r[0], f"mão {s}→{r[2]}@{f/FPS:.2f}s"))(BR.colisao_mao(arm, CORPO, s)) for f in range(NL + 1) for s in "lr" if not sc.frame_set(f) and not vl.update()), key=lambda r: r[0])
    EMP = {s: round(max(v.length for v in PUSHR[s])*100, 1) for s in "lr"}
    act = arm.animation_data.action; act.name = "Repouso"; act.use_fake_user = True
    # ---- bake (skill blender-animation) das duas ações: IK/Copy Rotation → chaves FK ----
    sys.path.insert(0, os.path.join(SKILLS, "blender-animation", "scripts")); import bake_action
    out = bake_action.run(source=arm.name, target=arm.name, actions=["Repouso"], clean=False)
    out["torcao_max_graus"] = BR.max_twist(arm, REST, range(0, NL + 1, 3), sc, vl); out["dedos_pele_min_mm"] = round(PELE*1000, 1); out["dedos_pele_onde"] = PELE_ONDE; out["ciclos_colisao"] = CICLOS; out["empurrao_cm"] = EMP
    for o in [o for o in bpy.data.objects if o != arm]: bpy.data.objects.remove(o, do_unlink=True)
    for pb in arm.pose.bones:
        for c in list(pb.constraints): pb.constraints.remove(c)
    out["polo_cotovelo_graus"] = "analitico"
    return arm, sc, vl, REST, out

arm, sc, vl, REST, baked = None, None, None, None, None
report = {}
for side in ("r", "l"):
    arm, sc, vl, REST, baked = build(side == "l")
    acts = {a.name: a for a in bpy.data.actions if a.name == "Repouso"}
    # canhoto: espelho exato osso a osso (o mesmo de cobranca.py), aplicado às duas ações
    def frames_of(a_, n_):
        arm.animation_data.action = a_; out = []
        for f in range(n_ + 1):
            sc.frame_set(f); vl.update(); out.append({b.name: b.matrix.copy() for b in arm.pose.bones})
        return out
    if side == "l":
        S_ = Matrix.Diagonal((-1, 1, 1, 1)); pbs = list(arm.pose.bones)
        twin = lambda n_: n_[:-2] + ("_r" if n_.endswith("_l") else "_l") if n_[-2:] in ("_l", "_r") else n_
        RM = {b.name: b.bone.matrix_local.copy() for b in pbs}; par = {b.name: (b.parent.name if b.parent else None) for b in pbs}
        for nm_, n_ in (("Repouso", NL),):
            fr = frames_of(acts[nm_], n_); prevq = {}
            for f, Ms in enumerate(fr):
                new = {nm: (S_ @ (Ms[twin(nm)] @ RM[twin(nm)].inverted()) @ S_) @ RM[nm] for nm in Ms}
                for b in pbs:
                    nm = b.name; p = par[nm]; local = (new[p].inverted() @ new[nm]) if p else new[nm]; restrel = (RM[p].inverted() @ RM[nm]) if p else RM[nm]
                    loc, q, _ = (restrel.inverted() @ local).decompose()
                    if nm in prevq and prevq[nm].dot(q) < 0: q = -q
                    prevq[nm] = q; b.location = loc; b.rotation_quaternion = q
                    b.keyframe_insert("location", frame=f, group=nm); b.keyframe_insert("rotation_quaternion", frame=f, group=nm)
    # ---- verificação: pés parados, laço sem emenda, mão na cintura perto do quadril, dedos curvados ----
    fr = frames_of(acts["Repouso"], NL); hs = "r" if side == "r" else "l"; os_ = "l" if hs == "r" else "r"
    drift = {s: round(max((fr[i][f"ball_{s}"].translation - fr[0][f"ball_{s}"].translation).length for i in range(NL + 1))*1000, 2) for s in "lr"}
    seam = round(max(((fr[0][b].translation - fr[NL][b].translation).length) for b in ("pelvis", "hand_l", "hand_r", "Head"))*1000, 2)
    mid = round(2.8*FPS); hand_hip = round((fr[mid][f"hand_{hs}"].translation - (fr[mid]["pelvis"].translation + (fr[mid]["pelvis"].to_3x3() @ REST["pelvis"].to_3x3().inverted()) @ Vector(((1 if hs == "l" else -1)*.20, -.01, .14)))).length*1000, 1)
    elbow_out = round(abs(fr[mid][f"lowerarm_{hs}"].translation.x - fr[mid]["pelvis"].translation.x), 3)
    hand_free = round(abs(fr[0][f"hand_{hs}"].translation.x - fr[0]["pelvis"].translation.x), 3)
    report[side] = {"torcao": baked.get("torcao_max_graus"), "dedos_pele_min_mm_antes_do_bake": baked.get("dedos_pele_min_mm"), "dedos_pele_onde": baked.get("dedos_pele_onde"), "ciclos_colisao": baked.get("ciclos_colisao"), "empurrao_cm": baked.get("empurrao_cm"), "pes_deriva_mm": drift, "emenda_laco_mm": seam, "mao_cintura_dist_alvo_mm": hand_hip, "cotovelo_afastado_m": elbow_out, "mao_solta_x_m": hand_free,
                    "pe_mais_baixo_z": round(min(min(m["ball_l"].translation.z, m["ball_r"].translation.z) for m in fr), 3)}
    if os.environ.get("REP_DIAG"):
        m = fr[mid]; P_ = m["pelvis"].translation
        print("@@DIAG@@", side, {k: [round(c, 3) for c in (m[k].translation - P_)] for k in ("upperarm_r", "lowerarm_r", "hand_r", "upperarm_l", "lowerarm_l", "hand_l", "thigh_r")}, "pelve", [round(c, 3) for c in P_])
    arm["repouso_loop_s"] = LOOP; arm["repouso_fps"] = FPS; arm["repouso_pe"] = side
    sc.frame_set(0)
    for o in bpy.data.objects: o.select_set(o == arm)
    vl.objects.active = arm
    arm.animation_data.action = acts["Repouso"]
    os.makedirs(os.path.abspath(OUT_DIR), exist_ok=True); out = os.path.join(os.path.abspath(OUT_DIR), f"repouso_{side}.glb")
    r = bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_animations=True, export_animation_mode="ACTIONS",
                                  export_force_sampling=True, export_extras=True, export_skins=False, export_morph=False, export_materials="NONE")
    report[side]["export"] = list(r); report[side]["bytes"] = os.path.getsize(out)
print("@@JSON@@" + json.dumps(report))
