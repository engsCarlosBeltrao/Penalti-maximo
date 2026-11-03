# ANIMAÇÃO DO CHUTE no Blender 5.2 (modo background). Não altera o athlete.glb: importa o esqueleto dele, anima, faz o bake e exporta
# SÓ o esqueleto + o clipe "Chute" (assets/models/anim/chute.glb). O jogo aplica o clipe ao athlete.glb pelos nomes dos ossos.
# Método (skills blender-animation / blender-character-rigging): IK de 2 ossos nas pernas (alvo = tornozelo, polo = joelho para a frente),
# pé com Copy Rotation do alvo (pé de apoio TRAVADO no gramado), quadril/coluna/cabeça/braços por quadros-chave (Bézier), bake visual para FK
# no próprio esqueleto (bake_action.py, "self-bake") e exportação glTF por ações.
# Espaço do clipe (Blender): bola parada em (0, 0, 0.11); o cobrador olha para -Y (o gol); o lado esquerdo dele é +X; chuta com a perna DIREITA.
# Contato pé-bola no quadro CONTACT (30 fps). Nos extras do nó "Armature": chute_contato_s, chute_fps, bola.
# Uso: blender -b --factory-startup --python-exit-code 1 -P tools/blender/chute.py -- assets/models/athlete.glb assets/models/anim/chute.glb .claude/skills
import bpy, sys, os, json, math
from mathutils import Vector, Matrix, Quaternion

args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT, SKILLS = args[0], args[1], args[2]
FPS, CONTACT, END = 30, 17, 38
BALL = Vector((0, 0, .11))
D = math.radians

bpy.ops.wm.read_factory_settings(use_empty=True)
assert bpy.ops.import_scene.gltf(filepath=SRC) == {"FINISHED"}
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
for o in [o for o in bpy.data.objects if o != arm]: bpy.data.objects.remove(o, do_unlink=True)   # só o esqueleto (o modelo não é reexportado)
sc = bpy.context.scene; sc.render.fps = FPS; sc.frame_start, sc.frame_end = 0, END
vl = bpy.context.view_layer
for pb in arm.pose.bones: pb.rotation_mode = "QUATERNION"
REST = {b.name: b.matrix_local.copy() for b in arm.data.bones}
AN = REST["foot_r"].translation.z                                   # altura do tornozelo com o pé no chão

# ---------- rotações no espaço do esqueleto ----------
def rot(yaw=0, lean=0, tilt=0):                                     # yaw em Z (negativo = vira para -X), lean em X (+ = para a frente), tilt em Y (+ = para +X)
    return Matrix.Rotation(D(yaw), 3, "Z") @ Matrix.Rotation(D(lean), 3, "X") @ Matrix.Rotation(D(tilt), 3, "Y")
def set_rot(name, R, loc=None):                                     # orientação ABSOLUTA = R · repouso (o osso gira em torno da própria cabeça)
    vl.update(); pb = arm.pose.bones[name]
    M = (R @ REST[name].to_3x3()).to_4x4(); M.translation = loc if loc is not None else pb.head.copy(); pb.matrix = M
def aim(name, d):                                                   # aponta o eixo do osso (Y) para a direção d, com a menor rotação a partir do repouso
    y = REST[name].to_3x3().col[1].normalized(); set_rot(name, y.rotation_difference(Vector(d).normalized()).to_matrix())
PREV = {}
def key(name, loc=False):
    pb = arm.pose.bones[name]; q = pb.rotation_quaternion
    if name in PREV and PREV[name].dot(q) < 0: pb.rotation_quaternion = -q          # continuidade do quatérnio (sem giro de 360°)
    PREV[name] = pb.rotation_quaternion.copy(); pb.keyframe_insert("rotation_quaternion", frame=sc.frame_current, group=name)
    if loc: pb.keyframe_insert("location", frame=sc.frame_current, group=name)

# ---------- IK das pernas ----------
def empty(n):
    e = bpy.data.objects.new(n, None); e.empty_display_size = .08; sc.collection.objects.link(e); e.rotation_mode = "QUATERNION"; return e
IKT = {s: empty(f"IK_pe_{s}") for s in "lr"}; POLE = {s: empty(f"Polo_joelho_{s}") for s in "lr"}
for s in "lr":
    c = arm.pose.bones[f"calf_{s}"].constraints.new("IK"); c.target = IKT[s]; c.pole_target = POLE[s]; c.chain_count = 2
    cr = arm.pose.bones[f"foot_{s}"].constraints.new("COPY_ROTATION"); cr.target = IKT[s]
def place_foot(s, pos, yaw=0, pitch=0):                             # alvo do tornozelo + orientação do pé (pitch + = ponta para baixo)
    M = (rot(yaw, pitch) @ REST[f"foot_{s}"].to_3x3()).to_4x4(); M.translation = Vector(pos); IKT[s].matrix_world = M
def place_pole(s, pelvis, yaw):
    side = -1 if s == "r" else 1; POLE[s].location = Vector(pelvis) + rot(yaw) @ Vector((side*.1, -.9, -.35))
# ângulo do polo: o que mantém o joelho no plano da perna (menor deslocamento com o alvo levemente erguido)
best = None
for a in (-180, -90, 0, 90):
    for s in "lr": arm.pose.bones[f"calf_{s}"].constraints[0].pole_angle = D(a)
    for s in "lr": place_foot(s, REST[f"foot_{s}"].translation + Vector((0, 0, .06))); place_pole(s, REST["pelvis"].translation, 0)
    vl.update(); err = sum((arm.pose.bones[f"calf_{s}"].head - REST[f"calf_{s}"].translation).length for s in "lr")
    if best is None or err < best[1]: best = (a, err)
for s in "lr": arm.pose.bones[f"calf_{s}"].constraints[0].pole_angle = D(best[0])

# ---------- QUADROS-CHAVE (bloqueio → intermediárias → Bézier) ----------
# quadril: posição (x, y, z) + (yaw, lean, tilt); tronco (peito): (yaw, lean, tilt); cabeça: inclinação para baixo sobre o peito
PELVIS = {0: ((.95, 1.45, .93), (0, 3, 0)), 4: ((.80, 1.12, .90), (-20, 8, 0)), 8: ((.60, .72, .95), (-25, 10, 0)), 11: ((.42, .40, .88), (-30, -3, 5)),
          14: ((.34, .28, .86), (-38, -6, 8)), 17: ((.30, .22, .86), (-12, 0, 10)), 20: ((.24, .08, .90), (5, 8, 8)), 24: ((.20, -.02, .93), (10, 12, 4)),
          30: ((.20, -.05, .92), (0, 6, 0)), 38: ((.20, -.05, .92), (0, 4, 0))}
CHEST = {0: (0, 5, 0), 4: (-12, 10, 0), 8: (-15, 12, 0), 11: (-12, 0, 8), 14: (-8, -4, 14), 17: (-18, 6, 16), 20: (-5, 15, 10), 24: (5, 18, 5), 30: (0, 10, 0), 38: (0, 6, 0)}
HEAD = {0: 15, 4: 18, 8: 22, 11: 30, 14: 32, 17: 35, 20: 25, 24: 10, 30: 5, 38: 5}
# pés: posição do tornozelo, yaw e pitch (ponta para baixo); perna de CHUTE = direita ('r'), de APOIO = esquerda ('l')
R = {0: ((.836, 1.494, AN), -0, 0), 2: ((.75, 1.22, .16), -15, 10), 4: ((.66, .95, AN), -20, 0), 7: ((.66, .93, .12), -22, 12), 9: ((.52, .85, .30), -25, 40),
     12: ((.30, .72, .48), -30, 35), 14: ((.20, .66, .52), -30, 35), 15: ((.17, .64, .50), -27, 40), 16: ((.10, .47, .33), -18, 52), 17: ((-.01, .13, .235), -10, 60),
     18: ((-.05, -.06, .34), -8, 55), 20: ((-.05, -.45, .58), -5, 40), 23: ((-.04, -.80, .95), 0, 25), 27: ((-.03, -.50, .42), 0, 10), 30: ((-.02, -.22, AN), 0, 0), 38: ((-.02, -.22, AN), 0, 0)}
L = {0: ((1.064, 1.494, AN), 0, 0), 4: ((1.064, 1.494, AN), 0, 0), 5: ((1.06, 1.47, .12), -10, 12), 6: ((.90, 1.05, .18), -20, 0), 8: ((.62, .55, .22), -25, -10),
     11: ((.24, .10, AN), -28, -5), 12: ((.24, .10, AN), -28, 0), 21: ((.24, .10, AN), -28, 0), 23: ((.24, .06, .17), -20, 25), 26: ((.27, -.02, .15), -10, 10),
     30: ((.30, -.10, AN), 0, 0), 38: ((.30, -.10, AN), 0, 0)}
# braços: direção do braço e do antebraço no referencial do PEITO (frente = -Y, esquerda = +X, cima = +Z)
ARM_L = {0: ((.25, 0, -1), (.2, -.25, -1)), 4: ((.2, -.6, -.8), (.1, -.9, -.3)), 8: ((.25, .5, -.85), (.2, .2, -1)), 11: ((.9, -.35, .05), (.6, -.75, .1)),
         14: ((.9, -.35, .05), (.6, -.75, .1)), 17: ((.95, -.15, .15), (.7, -.6, .3)), 20: ((.7, -.5, -.3), (.3, -.9, -.1)), 24: ((.45, -.4, -.8), (.2, -.6, -.6)),
         30: ((.25, -.1, -1), (.2, -.35, -.95)), 38: ((.25, 0, -1), (.2, -.25, -1))}
ARM_R = {0: ((-.25, 0, -1), (-.2, -.25, -1)), 4: ((-.25, .5, -.85), (-.2, .2, -1)), 8: ((-.2, -.6, -.8), (-.1, -.9, -.3)), 11: ((-.6, .45, -.5), (-.5, .2, -.6)),
         14: ((-.6, .45, -.5), (-.5, .2, -.6)), 17: ((-.55, .35, -.6), (-.4, 0, -.8)), 20: ((-.4, -.3, -.75), (-.3, -.6, -.5)), 24: ((-.3, -.3, -.9), (-.2, -.5, -.8)),
         30: ((-.25, -.05, -1), (-.2, -.3, -.95)), 38: ((-.25, 0, -1), (-.2, -.25, -1))}
FRAMES = sorted(set(PELVIS) | set(R) | set(L) | set(ARM_L))
def at(tab, f):                                                     # valor do quadro-chave ou interpolado linearmente (só para montar os quadros intermediários)
    ks = sorted(tab); f0 = max(k for k in ks if k <= f); f1 = min(k for k in ks if k >= f)
    if f0 == f1: return tab[f0]
    u = (f - f0)/(f1 - f0); a, b = tab[f0], tab[f1]
    mix = lambda x, y: tuple(mix(p, q) for p, q in zip(x, y)) if isinstance(x, tuple) else x + (y - x)*u
    return mix(a, b)
for f in FRAMES:
    sc.frame_set(f)
    (pp, (py, pl, pt)), ch = at(PELVIS, f), at(CHEST, f); Rp, Rc = rot(py, pl, pt), rot(*ch)
    set_rot("pelvis", Rp, Vector(pp)); key("pelvis", loc=True)
    qp, qc = Rp.to_quaternion(), Rc.to_quaternion()
    for i, b in enumerate(("spine_01", "spine_02", "spine_03")): set_rot(b, qp.slerp(qc, (i + 1)/3).to_matrix()); key(b)
    Rh = Rc @ Matrix.Rotation(D(at(HEAD, f)), 3, "X")
    set_rot("neck_01", qc.slerp(Rh.to_quaternion(), .5).to_matrix()); key("neck_01"); set_rot("Head", Rh); key("Head")
    for s, T in (("l", ARM_L), ("r", ARM_R)):
        up, lo = at(T, f); aim(f"upperarm_{s}", Rc @ Vector(up)); key(f"upperarm_{s}"); aim(f"lowerarm_{s}", Rc @ Vector(lo)); key(f"lowerarm_{s}")
    for s, T in (("r", R), ("l", L)):
        pos, yaw, pitch = at(T, f); place_foot(s, pos, yaw, pitch); IKT[s].keyframe_insert("location", frame=f); IKT[s].keyframe_insert("rotation_quaternion", frame=f)
        place_pole(s, pp, py); POLE[s].keyframe_insert("location", frame=f)
act = arm.animation_data.action; act.name = "Chute"; act.use_fake_user = True

# ---------- BAKE (skill blender-animation): IK e Copy Rotation → chaves FK em todos os quadros ----------
sys.path.insert(0, os.path.join(SKILLS, "blender-animation", "scripts")); import bake_action
baked = bake_action.run(source=arm.name, target=arm.name, actions=["Chute"])
for o in [o for o in bpy.data.objects if o != arm]: bpy.data.objects.remove(o, do_unlink=True)
for pb in arm.pose.bones:
    for c in list(pb.constraints): pb.constraints.remove(c)

# ---------- verificação (números, não adjetivos) ----------
def wpos(name, tail=False): vl.update(); pb = arm.pose.bones[name]; return (pb.tail if tail else pb.head).copy()
sc.frame_set(CONTACT); vl.update()
foot_ball = min((wpos("ball_r") - BALL).length, (wpos("foot_r") - BALL).length) - .11
laces = ((wpos("ball_r") + wpos("foot_r"))/2 - BALL).length - .11            # meio do peito do pé (lado de cima, ~4–5 cm acima desse eixo)
pts = []; speeds = []; low = 9
for f in range(0, END + 1):
    sc.frame_set(f); vl.update(); pts.append((wpos("foot_l"), wpos("ball_r"))); z = min(wpos("ball_r", True).z, wpos("ball_l", True).z); lowf = f if z < low else (lowf if f else 0); low = min(low, z)
for f in range(1, END + 1): speeds.append(round((pts[f][1] - pts[f - 1][1]).length*FPS, 2))
drift = max((pts[f][0] - pts[11][0]).length for f in range(11, 22))
lens = {b: round((arm.data.bones[b].tail_local - arm.data.bones[b].head_local).length, 4) for b in ("thigh_r", "calf_r", "thigh_l", "calf_l")}
report = {"ok": True, "pole_angle": best[0], "baked": baked.get("baked", baked), "frames": [0, END], "contact_frame": CONTACT,
          "contato_pe_superficie_bola_m": round(foot_ball, 3), "eixo_peito_do_pe_superficie_bola_m": round(laces, 3), "ponta_mais_baixa_z_m": round(low, 3), "quadro_ponta_mais_baixa": lowf, "deriva_pe_apoio_f11_f21_m": round(drift, 4),
          "vel_ponta_pe_ms": speeds, "pico_vel_quadro": 1 + speeds.index(max(speeds)), "comprimentos": lens}

# ---------- exportação: só esqueleto + clipe, com o quadro do contato nos extras ----------
arm["chute_contato_s"] = CONTACT/FPS; arm["chute_fps"] = FPS; arm["bola"] = [0.0, .11, 0.0]          # bola em coordenadas glTF (Y para cima)
sc.frame_set(0)
for o in bpy.data.objects: o.select_set(o == arm)
vl.objects.active = arm
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
r = bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", use_selection=True, export_animations=True, export_animation_mode="ACTIONS",
                              export_force_sampling=True, export_extras=True, export_skins=False, export_morph=False, export_materials="NONE")
report["export"] = list(r); report["arquivo"] = os.path.abspath(OUT); report["bytes"] = os.path.getsize(OUT)
print("@@JSON@@" + json.dumps(report))
