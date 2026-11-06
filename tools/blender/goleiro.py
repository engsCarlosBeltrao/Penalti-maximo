# GOLEIRO — retargeting das animações do Mixamo fornecidas (FBX, esqueleto "mixamorig:", 65 ossos com dedos) para o ESQUELETO do athlete.glb,
# e medição dos COLISORES de cada clipe (mãos, antebraços, braços, tronco, cabeça, coxas, canelas, pés) quadro a quadro, no mesmo referencial do jogo.
# Blender 5.2, modo background. Sai só esqueleto + clipe (o modelo, uniformes e materiais do jogo não são tocados), como os outros clipes do projeto.
#
#  - retarget: tools da skill blender-animation (retarget.py): cada osso recebe a MUDANÇA de rotação do osso de origem em relação ao repouso,
#    aplicada ao seu próprio repouso (rolls e eixos diferentes não importam); a pelve recebe a translação escalada pela altura do quadril.
#    Mapa explícito osso a osso, INCLUINDO os dedos (o mapa automático não reconhece "LeftHandIndex1" ↔ "index_01_l").
#  - referencial: o do corpo (de frente para -Y, esquerda do goleiro = +X), pelve começando na origem, pés no chão no 1º quadro.
#  - colisores: posições dos ossos em coordenadas do three.js (x, z, -y) — o jogo só soma a posição do goleiro (e espelha x no lado oposto).
# Uso: blender -b --factory-startup --python-exit-code 1 -P tools/blender/goleiro.py -- assets/models/athlete.glb <pasta_fbx> assets/models/anim .claude/skills [nomes]
import bpy, sys, os, json, math
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index("--") + 1:]
SRC, FBX_DIR, OUT_DIR, SKILLS = args[:4]
FPS = 30
sys.path.insert(0, os.path.join(SKILLS, "blender-animation", "scripts")); import retarget as RT

# clipe do jogo → (arquivo fornecido, espelhar?, adaptação). Lados do PONTO DE VISTA DO GOLEIRO (esquerda dele = +X do corpo = +x do mundo, ele olha +z).
# Medido (tools/blender/goleiro.py, mãos e pelve): Diving Save = mergulho ALTO à direita (mãos a 1,57 m, 3,4 m de alcance); Diving Save (1) = MÉDIO à
# esquerda (1,27 m, 2,7 m); Body Block = BAIXO à esquerda; Body Block (1) = BAIXO à direita (~1,95 m); Catch = agarra ALTO no centro saltando (2,36 m);
# Catch (1) = agarra na altura do PEITO (1,5 m). Faltavam: médio à direita e alto à esquerda (espelho exato osso a osso) e baixo no centro
# (adaptação do Catch (1): agacha com os pés travados por IK e leva as mãos ao chão por IK).
# Medido no jogo (test_keeper.mjs): o Diving Save só levava as mãos a 1,57 m — não alcança a parte alta do gol (até 2,44 m) — e o Body Block só a ~1,95 m
# para o lado. Adaptação "estende": durante o voo (janela de tempo) a pelve sobe e as mãos são levadas (IK, braço ainda do clipe) mais para cima/para fora,
# entrando e saindo suavemente; impulsão, queda e recuperação continuam as do clipe fornecido.
ALTO = ("estende", dict(mao=(.18, .5, .05), pelve=.3, janela=(.42, .85, 1.25)))     # (para fora, para cima, para a frente) em m; janela (início, pico, fim) em s
BAIXO = ("estende", dict(mao=(.45, -.05, .1), pelve=0, janela=(.55, 1.0, 1.45)))
# Avanço: nos mergulhos do Mixamo a pelve vai até 1,7 m PARA A FRENTE (root motion do próprio clipe; o jogo não soma nada). Goleiros reais dão um
# passo frontal de ~0,31–0,49 m (Monteiro et al., Sci Rep 2024, PMC11068781). FRENTE comprime a translação frontal da pelve: igual até `livre`,
# depois tende suavemente a `max` (o alcance lateral e a altura ficam intactos).
FRENTE = dict(livre=.2, max=.45)
PRONTO = ("pronto", dict(prep=False)); PREPARA = ("pronto", dict(prep=True, quadros=45))
def CURTA(h): return ("curta", dict(h=h))
CLIPES = {
    "gk_espera":       ("Goalkeeper Idle.fbx", False, PRONTO),             # espera em prontidão (joelhos flexionados, tronco à frente, mãos prontas)
    "gk_prepara":      ("Goalkeeper Idle.fbx", False, PREPARA),            # 1,5 s antes do contato: ajustes dos pés, flexão, braços, split-step
    "gk_esq_curta_baixa": ("Goalkeeper Body Block.fbx", False, CURTA(.28)),  # passo lateral curto + extensão dos braços (bola perto do corpo)
    "gk_esq_curta_media": ("Goalkeeper Body Block.fbx", False, CURTA(1.0)),
    "gk_esq_curta_alta":  ("Goalkeeper Body Block.fbx", False, CURTA(1.85)),
    "gk_dir_curta_baixa": ("Goalkeeper Body Block.fbx", True, CURTA(.28)),
    "gk_dir_curta_media": ("Goalkeeper Body Block.fbx", True, CURTA(1.0)),
    "gk_dir_curta_alta":  ("Goalkeeper Body Block.fbx", True, CURTA(1.85)),
    "gk_esq_baixa":    ("Goalkeeper Body Block.fbx", False, BAIXO),
    "gk_dir_baixa":    ("Goalkeeper Body Block (1).fbx", False, BAIXO),
    "gk_esq_media":    ("Goalkeeper Diving Save (1).fbx", False, None),
    "gk_dir_media":    ("Goalkeeper Diving Save (1).fbx", True, None),
    "gk_dir_alta":     ("Goalkeeper Diving Save.fbx", False, ALTO),
    "gk_esq_alta":     ("Goalkeeper Diving Save.fbx", True, ALTO),
    "gk_centro_baixa": ("Goalkeeper Catch (1).fbx", False, ("agacha", {})),
    "gk_centro_media": ("Goalkeeper Catch (1).fbx", False, None),
    "gk_centro_alta":  ("Goalkeeper Catch.fbx", False, None),
}
LADO = {"Left": "l", "Right": "r"}
def mapa():
    m = {"pelvis": "mixamorig:Hips", "spine_01": "mixamorig:Spine", "spine_02": "mixamorig:Spine1", "spine_03": "mixamorig:Spine2", "neck_01": "mixamorig:Neck", "Head": "mixamorig:Head"}
    for L, s in LADO.items():
        m |= {f"clavicle_{s}": f"mixamorig:{L}Shoulder", f"upperarm_{s}": f"mixamorig:{L}Arm", f"lowerarm_{s}": f"mixamorig:{L}ForeArm", f"hand_{s}": f"mixamorig:{L}Hand",
              f"thigh_{s}": f"mixamorig:{L}UpLeg", f"calf_{s}": f"mixamorig:{L}Leg", f"foot_{s}": f"mixamorig:{L}Foot", f"ball_{s}": f"mixamorig:{L}ToeBase"}
        for d, D in (("thumb", "Thumb"), ("index", "Index"), ("middle", "Middle"), ("ring", "Ring"), ("pinky", "Pinky")):
            for i in (1, 2, 3): m[f"{d}_0{i}_{s}"] = f"mixamorig:{L}Hand{D}{i}"
    return m
# colisores: (nome, osso A, osso B ou None, raio em m) — cápsula de A até B (esfera se B for None); raios do corpo do athlete.glb
COLISORES = [("mao_l", "hand_l", "middle_02_l", .055), ("mao_r", "hand_r", "middle_02_r", .055),
             ("antebraco_l", "lowerarm_l", "hand_l", .045), ("antebraco_r", "lowerarm_r", "hand_r", .045),
             ("braco_l", "upperarm_l", "lowerarm_l", .055), ("braco_r", "upperarm_r", "lowerarm_r", .055),
             ("tronco", "pelvis", "neck_01", .16), ("cabeca", "Head", None, .12),
             ("coxa_l", "thigh_l", "calf_l", .08), ("coxa_r", "thigh_r", "calf_r", .08), ("canela_l", "calf_l", "foot_l", .06), ("canela_r", "calf_r", "foot_r", .06),
             ("pe_l", "foot_l", "ball_l", .055), ("pe_r", "foot_r", "ball_r", .055)]

def agacha(tgt, sc, vl, N):
    """Defesa BAIXA no centro a partir do Catch (1): a pelve desce até 30 cm com os pés travados (IK nas pernas, alvos = pés do clipe original), o tronco
    inclina à frente e as mãos vão ao chão à frente dos pés (IK nos braços), entrando e saindo suavemente; depois é assado em FK (bake_action)."""
    pb = tgt.pose.bones; sm = lambda u: (lambda v: v*v*(3 - 2*v))(min(1, max(0, u)))
    w = lambda t: sm((t - .22)/.30) * (1 - sm((t - .95)/.25))         # 0 → 1 (0,22–0,52 s), segura, volta (0,95–1,20 s)
    feet = []
    for f in range(1, N + 2): sc.frame_set(f); vl.update(); feet.append({s: pb[f"foot_{s}"].matrix.copy() for s in "lr"})
    E = lambda n: (lambda e: (sc.collection.objects.link(e), e)[1])(bpy.data.objects.new(n, None))
    PE = {s: E(f"pe_{s}") for s in "lr"}; MA = {s: E(f"mao_{s}") for s in "lr"}; PO = {s: E(f"polo_{s}") for s in "lr"}; PB = {s: E(f"polo_b_{s}") for s in "lr"}
    for s in "lr":
        c = pb[f"calf_{s}"].constraints.new("IK"); c.target = PE[s]; c.pole_target = PO[s]; c.chain_count = 2; c.pole_angle = math.radians(-90)
        cr = pb[f"foot_{s}"].constraints.new("COPY_ROTATION"); cr.target = PE[s]
        a = pb[f"lowerarm_{s}"].constraints.new("IK"); a.target = MA[s]; a.pole_target = PB[s]; a.chain_count = 2; a.pole_angle = math.radians(-90)
    for f in range(1, N + 2):
        t = (f - 1)/FPS; k = w(t); sc.frame_set(f); vl.update()
        P = pb["pelvis"]; M = P.matrix.copy(); M.translation.z -= .36*k; P.matrix = M; P.keyframe_insert("location", frame=f, group="pelvis")
        for b_, a_ in (("spine_01", 22), ("spine_02", 18), ("spine_03", 12)):     # rotação +X do osso = tronco à frente (medido na trilha do tronco)
            q = pb[b_].rotation_quaternion.copy(); pb[b_].rotation_quaternion = Matrix.Rotation(math.radians(a_*k), 4, "X").to_quaternion() @ q; pb[b_].keyframe_insert("rotation_quaternion", frame=f, group=b_)
        vl.update(); Pw = pb["pelvis"].head
        for s in "lr":
            sg = 1 if s == "l" else -1
            PE[s].matrix_world = feet[f - 1][s]; PE[s].keyframe_insert("location", frame=f); PE[s].keyframe_insert("rotation_euler", frame=f)
            PO[s].location = Pw + Vector((sg*.15, -.9, -.3)); PO[s].keyframe_insert("location", frame=f)
            free = pb[f"hand_{s}"].head.copy(); low = Vector((Pw.x + sg*.12, Pw.y - .5, .13)); MA[s].location = free.lerp(low, k); MA[s].keyframe_insert("location", frame=f)
            PB[s].location = Pw + Vector((sg*.7, .3, .3)); PB[s].keyframe_insert("location", frame=f)
        for s in "lr": pb[f"lowerarm_{s}"].constraints[-1].influence = k; pb[f"lowerarm_{s}"].constraints[-1].keyframe_insert("influence", frame=f)
    sys.path.insert(0, os.path.join(SKILLS, "blender-animation", "scripts")); import bake_action
    bake_action.run(source=tgt.name, target=tgt.name, actions=[tgt.animation_data.action.name], clean=False)
    for b in pb:
        for c in list(b.constraints): b.constraints.remove(c)
    for o in [o for o in bpy.data.objects if o != tgt]: bpy.data.objects.remove(o, do_unlink=True)

def estende(tgt, sc, vl, N, mao=(0, 0, 0), pelve=0.0, janela=(.4, .8, 1.2)):
    """Mergulho mais estendido: na janela (t0, pico, t1) a pelve sobe `pelve` m e as mãos vão (IK nos braços) até a posição do clipe + `mao`
    (para fora no sentido do mergulho, para cima, para a frente), com peso em sino; fora da janela o clipe fica intacto. Assado em FK no fim."""
    pb = tgt.pose.bones; sm = lambda u: (lambda v: v*v*(3 - 2*v))(min(1, max(0, u))); t0, tp, t1 = janela
    w = lambda t: sm((t - t0)/(tp - t0)) if t < tp else 1 - sm((t - tp)/(t1 - tp))
    sc.frame_set(1); vl.update(); x0 = pb["pelvis"].head.x; sc.frame_set(N + 1); vl.update(); sg_ = 1 if pb["pelvis"].head.x > x0 else -1   # lado do mergulho
    orig = []
    for f in range(1, N + 2): sc.frame_set(f); vl.update(); orig.append({s: pb[f"hand_{s}"].head.copy() for s in "lr"})
    E = lambda n: (lambda e: (sc.collection.objects.link(e), e)[1])(bpy.data.objects.new(n, None))
    MA = {s: E(f"mao_{s}") for s in "lr"}; PB = {s: E(f"polo_b_{s}") for s in "lr"}
    for s in "lr":
        a = pb[f"lowerarm_{s}"].constraints.new("IK"); a.target = MA[s]; a.pole_target = PB[s]; a.chain_count = 2; a.pole_angle = math.radians(-90)
    for f in range(1, N + 2):
        t = (f - 1)/FPS; k = w(t); sc.frame_set(f); vl.update()
        P = pb["pelvis"]; M = P.matrix.copy(); M.translation.z += pelve*k; P.matrix = M; P.keyframe_insert("location", frame=f, group="pelvis")
        vl.update(); Pw = pb["pelvis"].head
        for s in "lr":
            sg = 1 if s == "l" else -1
            MA[s].location = orig[f - 1][s] + Vector((0, 0, pelve*k)) + Vector((sg_*mao[0], -mao[2], mao[1]))*k; MA[s].keyframe_insert("location", frame=f)
            PB[s].location = Pw + Vector((sg*.6, .5, -.2)); PB[s].keyframe_insert("location", frame=f)
            c = pb[f"lowerarm_{s}"].constraints[-1]; c.influence = k; c.keyframe_insert("influence", frame=f)
    sys.path.insert(0, os.path.join(SKILLS, "blender-animation", "scripts")); import bake_action
    bake_action.run(source=tgt.name, target=tgt.name, actions=[tgt.animation_data.action.name], clean=False)
    for b in pb:
        for c in list(b.constraints): b.constraints.remove(c)
    for o in [o for o in bpy.data.objects if o != tgt]: bpy.data.objects.remove(o, do_unlink=True)

def _ik(pb, osso, alvo, polo, n=2):
    c = pb[osso].constraints.new("IK"); c.target = alvo; c.pole_target = polo; c.chain_count = n; c.pole_angle = math.radians(-90); return c
def _vazio(sc, n): e = bpy.data.objects.new(n, None); sc.collection.objects.link(e); return e
def _assa(tgt):
    pb = tgt.pose.bones; sys.path.insert(0, os.path.join(SKILLS, "blender-animation", "scripts")); import bake_action
    bake_action.run(source=tgt.name, target=tgt.name, actions=[tgt.animation_data.action.name], clean=False)
    for b in pb:
        for c in list(b.constraints): b.constraints.remove(c)
    for o in [o for o in bpy.data.objects if o != tgt]: bpy.data.objects.remove(o, do_unlink=True)
def retempo(tgt, sc, vl, seq):
    """Reamostra o clipe: o quadro novo i+1 recebe a pose do quadro de origem seq[i] (ida, pausa, volta)."""
    pb = tgt.pose.bones; poses = {}
    for f in sorted(set(seq)): sc.frame_set(f); vl.update(); poses[f] = {b.name: (b.location.copy(), b.rotation_quaternion.copy()) for b in pb}
    tgt.animation_data.action = None
    for i, f in enumerate(seq, 1):
        for b in pb: b.location, b.rotation_quaternion = poses[f][b.name]; b.keyframe_insert("location", frame=i, group=b.name); b.keyframe_insert("rotation_quaternion", frame=i, group=b.name)
    return len(seq) - 1
def frente(tgt, sc, vl, N, livre=.2, max=.45):
    pb = tgt.pose.bones; sc.frame_set(1); vl.update(); y0 = pb["pelvis"].head.y
    for f in range(1, N + 2):
        sc.frame_set(f); vl.update(); P = pb["pelvis"]; M = P.matrix.copy(); fw = -(M.translation.y - y0)
        if fw > livre: fw = livre + (max - livre)*(1 - math.exp(-(fw - livre)/(max - livre))); M.translation.y = y0 - fw; P.matrix = M
        P.keyframe_insert("location", frame=f, group="pelvis")
def pronto(tgt, sc, vl, N, prep=False):
    """Postura de PRONTIDÃO sobre a espera do Mixamo: pés travados (IK), pelve 7 cm abaixo, tronco à frente, mãos à frente na altura do quadril, prontas.
    prep=True (1,5 s): a flexão aumenta, dois pequenos ajustes de pés (esq., dir.) e um split-step no fim, com os braços abrindo — a preparação para o chute."""
    pb = tgt.pose.bones; sm = lambda u: (lambda v: v*v*(3 - 2*v))(min(1, max(0, u)))
    bump = lambda t, a, b: math.sin(math.pi*min(1, max(0, (t - a)/(b - a))))
    feet = []
    for f in range(1, N + 2): sc.frame_set(f); vl.update(); feet.append({s: pb[f"foot_{s}"].matrix.copy() for s in "lr"})
    PE = {s: _vazio(sc, f"pe_{s}") for s in "lr"}; PO = {s: _vazio(sc, f"po_{s}") for s in "lr"}; MA = {s: _vazio(sc, f"ma_{s}") for s in "lr"}; PB = {s: _vazio(sc, f"pb_{s}") for s in "lr"}
    for s in "lr":
        _ik(pb, f"calf_{s}", PE[s], PO[s]); cr = pb[f"foot_{s}"].constraints.new("COPY_ROTATION"); cr.target = PE[s]; _ik(pb, f"lowerarm_{s}", MA[s], PB[s])
    for f in range(1, N + 2):
        t = (f - 1)/FPS; sc.frame_set(f); vl.update(); r = sm(t/1.2) if prep else 0
        ss = bump(t, 1.22, 1.42) if prep else 0                                           # split-step: pequeno salto com os dois pés
        P = pb["pelvis"]; M = P.matrix.copy(); M.translation.z += -(.07 + .07*r) + .03*ss; P.matrix = M; P.keyframe_insert("location", frame=f, group="pelvis")
        for b_, a_ in (("spine_01", 6 + 4*r), ("spine_02", 5 + 3*r), ("spine_03", 3)):
            q = pb[b_].rotation_quaternion.copy(); pb[b_].rotation_quaternion = Matrix.Rotation(math.radians(a_), 4, "X").to_quaternion() @ q; pb[b_].keyframe_insert("rotation_quaternion", frame=f, group=b_)
        vl.update(); Pw = pb["pelvis"].head.copy()
        for s in "lr":
            sg = 1 if s == "l" else -1; Mf = feet[f - 1][s].copy()
            if prep:                                                                      # ajustes de pés: esquerdo (0,35–0,6 s), direito (0,7–0,95 s), split-step
                u = bump(t, .35, .6) if s == "l" else bump(t, .7, .95); Mf.translation.z += .035*u + .025*ss; Mf.translation.x += sg*.03*(sm((t - .35)/.25) if s == "l" else sm((t - .7)/.25))
            PE[s].matrix_world = Mf; PE[s].keyframe_insert("location", frame=f); PE[s].keyframe_insert("rotation_euler", frame=f)
            PO[s].location = Pw + Vector((sg*.2, -.9, -.3)); PO[s].keyframe_insert("location", frame=f)
            free = pb[f"hand_{s}"].head.copy(); rd = Pw + Vector((sg*(.3 + .06*r), -.42, .1 - .05*r)); MA[s].location = free.lerp(rd, .75); MA[s].keyframe_insert("location", frame=f)
            PB[s].location = Pw + Vector((sg*.8, .2, -.3)); PB[s].keyframe_insert("location", frame=f)
    _assa(tgt)
def curta(tgt, sc, vl, N, h=1.0):
    """DEFESA CURTA: o passo lateral do Body Block (0–0,5 s, mocap) e a volta (o mesmo passo de trás para a frente), com as mãos levadas por IK até a
    altura h ao lado do corpo — para bolas a ~1–1,8 m do centro, sem mergulho completo. Pés travados (IK) quando a pelve desce para a bola baixa."""
    pb = tgt.pose.bones; sm = lambda u: (lambda v: v*v*(3 - 2*v))(min(1, max(0, u)))
    sc.frame_set(1); vl.update(); x0 = pb["pelvis"].head.x; sc.frame_set(16); vl.update(); sg_ = 1 if pb["pelvis"].head.x > x0 else -1
    N = retempo(tgt, sc, vl, list(range(1, 17)) + [16]*6 + list(range(15, 0, -1)) + [1]*4)
    w = lambda t: sm((t - .12)/.38)*(1 - sm((t - .72)/.45))
    feet = []
    for f in range(1, N + 2): sc.frame_set(f); vl.update(); feet.append({s: pb[f"foot_{s}"].matrix.copy() for s in "lr"})
    PE = {s: _vazio(sc, f"pe_{s}") for s in "lr"}; PO = {s: _vazio(sc, f"po_{s}") for s in "lr"}; MA = {s: _vazio(sc, f"ma_{s}") for s in "lr"}; PB = {s: _vazio(sc, f"pb_{s}") for s in "lr"}
    for s in "lr":
        _ik(pb, f"calf_{s}", PE[s], PO[s]); cr = pb[f"foot_{s}"].constraints.new("COPY_ROTATION"); cr.target = PE[s]; _ik(pb, f"lowerarm_{s}", MA[s], PB[s])
    desce = .16 if h < .6 else 0
    for f in range(1, N + 2):
        t = (f - 1)/FPS; k = w(t); sc.frame_set(f); vl.update()
        P = pb["pelvis"]; M = P.matrix.copy(); M.translation.z -= desce*k; P.matrix = M; P.keyframe_insert("location", frame=f, group="pelvis")
        if h < .6:
            for b_, a_ in (("spine_01", 14), ("spine_02", 10)):
                q = pb[b_].rotation_quaternion.copy(); pb[b_].rotation_quaternion = Matrix.Rotation(math.radians(a_*k), 4, "X").to_quaternion() @ q; pb[b_].keyframe_insert("rotation_quaternion", frame=f, group=b_)
        vl.update(); Pw = pb["pelvis"].head.copy()
        for s in "lr":
            sg = 1 if s == "l" else -1; lead = sg == sg_
            PE[s].matrix_world = feet[f - 1][s]; PE[s].keyframe_insert("location", frame=f); PE[s].keyframe_insert("rotation_euler", frame=f)
            PO[s].location = Pw + Vector((sg*.2, -.9, -.3)); PO[s].keyframe_insert("location", frame=f)
            free = pb[f"hand_{s}"].head.copy(); alvo = Vector((Pw.x + sg_*(.85 if lead else .5), Pw.y - (.3 if lead else .36), h - (0 if lead else .06)))
            MA[s].location = free.lerp(alvo, k); MA[s].keyframe_insert("location", frame=f)
            PB[s].location = Pw + Vector((sg*.7, .3, -.2 if h > .6 else .3)); PB[s].keyframe_insert("location", frame=f)
            c = pb[f"lowerarm_{s}"].constraints[-1]; c.influence = min(1, k*1.5); c.keyframe_insert("influence", frame=f)
    _assa(tgt); return N

def build(nome, fbx, espelho, adapta=None):
    bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene; sc.render.fps = FPS; vl = bpy.context.view_layer
    assert bpy.ops.import_scene.gltf(filepath=SRC) == {"FINISHED"}
    tgt = next(o for o in bpy.data.objects if o.type == "ARMATURE"); tgt.name = "ALVO"
    for o in [o for o in bpy.data.objects if o.type != "ARMATURE"]: bpy.data.objects.remove(o, do_unlink=True)
    assert bpy.ops.import_scene.fbx(filepath=os.path.join(FBX_DIR, fbx)) == {"FINISHED"}
    src = next(o for o in bpy.data.objects if o.type == "ARMATURE" and o != tgt); src.name = "ORIGEM"
    for o in [o for o in bpy.data.objects if o.type == "MESH"]: bpy.data.objects.remove(o, do_unlink=True)
    act = src.animation_data.action; f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    # frente da origem: a perna esquerda do Mixamo deve ficar em +X (de frente para -Y, como o athlete); senão, gira 180° (vale para a translação da pelve)
    vl.update(); lx = (src.matrix_world @ src.data.bones["mixamorig:LeftUpLeg"].head_local).x - (src.matrix_world @ src.data.bones["mixamorig:Hips"].head_local).x
    if lx < 0: src.rotation_euler.z += math.pi; vl.update()
    mp = os.path.join(bpy.app.tempdir, "mapa_goleiro.json"); json.dump(mapa(), open(mp, "w"))
    rep = RT.run(source=src.name, target=tgt.name, map=mp, frames=[f0, f1], name=nome)
    for o in [o for o in bpy.data.objects if o != tgt]: bpy.data.objects.remove(o, do_unlink=True)
    pb = tgt.pose.bones; N = f1 - f0
    # pelve começa na origem (xy) e os pés no chão no 1º quadro
    sc.frame_set(f0); vl.update(); P0 = pb["pelvis"].head.copy()
    low0 = min(min((pb[f"foot_{s}"].head).z, (pb[f"ball_{s}"].head).z) for s in "lr")
    off = Vector((-P0.x, -P0.y, -(low0 - .085)))                      # tornozelo/bola do pé ~8,5 cm acima do chão no repouso do athlete
    fc = tgt.animation_data.action
    for f in range(f0, f1 + 1):
        sc.frame_set(f); vl.update(); p = pb["pelvis"]
        M = p.matrix.copy(); M.translation = M.translation + off; p.matrix = M; p.keyframe_insert("location", frame=f - f0 + 1, group="pelvis")
        if f != f - f0 + 1: p.keyframe_insert("rotation_quaternion", frame=f - f0 + 1, group="pelvis")
    # (os demais ossos já estão chaveados de f0 a f1 = 1..N+1 no Mixamo)
    if adapta and adapta[0] == "pronto":
        if adapta[1].get("quadros"): N = adapta[1]["quadros"]
        pronto(tgt, sc, vl, N, prep=adapta[1].get("prep", False))
    if adapta and adapta[0] == "curta": N = curta(tgt, sc, vl, N, **adapta[1])
    if adapta and adapta[0] == "agacha": agacha(tgt, sc, vl, N, **adapta[1])
    if adapta and adapta[0] == "estende": estende(tgt, sc, vl, N, **adapta[1])
    if nome.startswith(("gk_esq_", "gk_dir_", "gk_centro_alta")) and "curta" not in nome: frente(tgt, sc, vl, N, **FRENTE)   # avanço limitado (mergulhos e salto)
    if espelho:
        S_ = Matrix.Diagonal((-1, 1, 1, 1)); pbs = list(pb); twin = lambda n_: n_[:-2] + ("_r" if n_.endswith("_l") else "_l") if n_[-2:] in ("_l", "_r") else n_
        RM = {b.name: b.bone.matrix_local.copy() for b in pbs}; par = {b.name: (b.parent.name if b.parent else None) for b in pbs}; fr_ = []
        for f in range(1, N + 2): sc.frame_set(f); vl.update(); fr_.append({b.name: b.matrix.copy() for b in pbs})
        for f, Ms in enumerate(fr_, 1):
            new = {nm: (S_ @ (Ms[twin(nm)] @ RM[twin(nm)].inverted()) @ S_) @ RM[nm] for nm in Ms}
            for b in pbs:
                nm = b.name; p = par[nm]; local = (new[p].inverted() @ new[nm]) if p else new[nm]; restrel = (RM[p].inverted() @ RM[nm]) if p else RM[nm]
                loc, q, _ = (restrel.inverted() @ local).decompose(); b.location = loc; b.rotation_quaternion = q
                b.keyframe_insert("location", frame=f, group=nm); b.keyframe_insert("rotation_quaternion", frame=f, group=nm)
    # ---- colisores quadro a quadro (three.js: x, z, -y) ----
    T3 = lambda v: [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]
    col = {c[0]: [] for c in COLISORES}; low = 9; maxz_mao = 0; maxx_mao = 0
    for f in range(1, N + 2):
        sc.frame_set(f); vl.update()
        for nm, a, b, r in COLISORES: col[nm].append(T3(pb[a].head) + (T3(pb[b].head) if b else []))
        low = min(low, *(pb[f"ball_{s}"].head.z for s in "lr")); maxz_mao = max(maxz_mao, *(pb[f"hand_{s}"].head.z for s in "lr")); maxx_mao = max(maxx_mao, *(abs(pb[f"hand_{s}"].head.x) for s in "lr"))
    tgt["clipe_goleiro"] = nome; tgt["clipe_duracao_s"] = N/FPS
    for o in bpy.data.objects: o.select_set(o == tgt)
    vl.objects.active = tgt; sc.frame_start, sc.frame_end = 1, N + 1; sc.frame_set(1)
    a_ = tgt.animation_data.action; a_.use_frame_range = True; a_.frame_start, a_.frame_end = 1, N + 1          # exporta só 1..N+1 (prepara/curtas são cortados)
    os.makedirs(os.path.abspath(OUT_DIR), exist_ok=True); out = os.path.join(os.path.abspath(OUT_DIR), nome + ".glb")
    r = bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_animations=True, export_animation_mode="ACTIONS",
                                  export_force_sampling=True, export_extras=True, export_skins=False, export_morph=False, export_materials="NONE")
    return dict(clipe=nome, fbx=fbx, espelho=espelho, adaptacao=adapta and [adapta[0], adapta[1]], quadros=N + 1, duracao_s=round(N/FPS, 3), mapeados=rep.get("mapped", rep.get("bones")), virou_180=lx < 0,
                pe_mais_baixo_z=round(low, 3), mao_mais_alta_z=round(maxz_mao, 3), mao_mais_lateral_x=round(maxx_mao, 3), export=list(r), bytes=os.path.getsize(out),
                colisores={nm: dict(raio=rr, ossos=[a, b]) for nm, a, b, rr in COLISORES}, trilhas=col)

QUAIS = args[4].split(",") if len(args) > 4 and args[4] else list(CLIPES)
rel = []
for nome in QUAIS:
    fbx, esp, ad = CLIPES[nome]; rel.append(build(nome, fbx, esp, ad))
json.dump(rel, open(os.path.join(os.path.abspath(OUT_DIR), "_goleiro_medidas.json"), "w"))
if len(args) > 5:                                                    # manifesto do jogo (js/keeperClips.js): duração, colisores e trilhas por clipe
    man = {r["clipe"]: dict(arquivo=r["clipe"] + ".glb", fps=FPS, dur=r["duracao_s"], fbx=r["fbx"], espelho=r["espelho"], adaptacao=r["adaptacao"],
                           raios={k: v["raio"] for k, v in r["colisores"].items()}, trilhas=r["trilhas"]) for r in rel}
    open(args[5], "w", encoding="utf8").write("// GERADO por tools/blender/goleiro.py — clipes do goleiro (retarget das animações do Mixamo fornecidas) e, quadro a quadro (30 fps),\n"
        "// os COLISORES no espaço do clipe (three.js: x = esquerda do goleiro, y = cima, z = frente): [x, y, z] (esfera) ou [x1, y1, z1, x2, y2, z2] (cápsula).\n"
        "export const KEEPER_CLIPS = " + json.dumps(man, separators=(",", ":")) + ";\n")
print("@@JSON@@" + json.dumps([{k: v for k, v in r.items() if k not in ("trilhas", "colisores")} for r in rel], ensure_ascii=False))
