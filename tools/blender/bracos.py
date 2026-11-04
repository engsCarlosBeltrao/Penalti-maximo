# BRAÇOS, MÃOS E DEDOS — solução ÚNICA usada por cobranca.py, repouso.py e reacoes.py (Blender, referencial do armature: frente = -Y, esquerda = +X, cima = +Z).
#
# Causa do problema das mãos deformadas: cada segmento do braço era orientado SOZINHO (menor rotação a partir da T-pose). Isso não respeita o cotovelo:
# a torção do antebraço em relação ao braço ficava arbitrária (até 159°), e mão orientada "no mundo" girava em torno do próprio eixo (até 129°).
# Este esqueleto não tem ossos de torção (twist), então a malha do punho torcia como papel de bala e a mão aparecia virada, com os dedos "para todo lado".
#
# Regras anatômicas aplicadas aqui:
#  1) COTOVELO É DOBRADIÇA: o braço é orientado para que a flexão do cotovelo caia no seu plano (a face anterior do braço aponta para o antebraço);
#     o antebraço é o braço girado em torno desse eixo de dobradiça. Torção extra (pronação/supinação) só quando pedida, limitada a ±70°.
#  2) PUNHO NÃO GIRA EM TORNO DO PRÓPRIO EIXO: a mão só dobra (flexão/extensão e desvio), no máximo 75°. Quando um gesto exige a palma virada
#     (mão na cabeça, no rosto, no quadril, no peito), arm_hand procura a pronação e a divide entre cotovelo e punho (≤ ~45° cada).
#  3) DEDOS: cada falange flexiona em torno do SEU eixo de dobradiça, medido no repouso (perpendicular ao dedo e à normal da palma); o polegar fecha
#     ATRAVESSANDO a palma (não no plano dos outros dedos). Poses: relaxada, punho, aponta (indicador estendido), aberta, apoio, luva (goleiro).
#  4) MÃO NÃO ENTRA NO CORPO: Corpo (abaixo) mede a distância dos dedos à pele; quem anima empurra o alvo do punho para fora pela normal.
import math
from mathutils import Vector, Matrix, Quaternion

FWD0 = Vector((0, -1, 0))        # na T-pose do athlete.glb o cotovelo flexiona para a FRENTE (palmas para baixo): face anterior do braço = -Y
PALM0 = Vector((0, 0, -1))       # normal da palma na T-pose (medido: dedos em ±X, indicador à frente, mínimo atrás, polegar para a frente e para baixo)


def _frame(a, b):                # base ortonormal (a, b⊥a, a×b) como matriz de colunas
    a = a.normalized(); b = (b - a*b.dot(a)).normalized(); return Matrix((a, b, a.cross(b))).transposed()


def _signed(a, b, axis):         # ângulo de a para b em torno de axis
    return math.atan2(axis.dot(a.cross(b)), a.dot(b))


def arm_world(REST, s, ua, fa, body_fwd, tw=0.0):
    """Rotações de MUNDO (delta sobre o repouso) do braço e do antebraço para as direções ua (ombro→cotovelo) e fa (cotovelo→punho).
    body_fwd: frente do tronco (para braço quase esticado, quando o plano do cotovelo não é definido). tw: pronação (graus, + = palma para dentro)."""
    ua, fa = Vector(ua).normalized(), Vector(fa).normalized()
    d0 = REST[f"upperarm_{s}"].to_3x3().col[1].normalized()
    a_fb = (body_fwd - ua*body_fwd.dot(ua))
    if a_fb.length < 1e-3: a_fb = (Vector((0, 0, 1)) - ua*ua[2])
    a_fb.normalize()
    bend = ua.angle(fa) if (ua - fa).length > 1e-6 else 0.0
    a_act = fa - ua*fa.dot(ua)
    if a_act.length > 1e-4:          # face anterior: do lado para onde o antebraço dobra; com braço quase reto, vai para a frente do tronco (suave, sem salto)
        a_act.normalize(); w = min(1.0, bend/math.radians(25)); w = w*w*(3 - 2*w)
        ang = _signed(a_fb, a_act, ua); a_use = Quaternion(ua, ang*w) @ a_fb
    else: a_use = a_fb
    Ru = _frame(ua, a_use) @ _frame(d0, FWD0).inverted()
    h = ua.cross(fa); hinge = h.normalized() if h.length > 1e-4 else ua.cross(a_use).normalized()   # ua→fa em torno de eixo ⟂ ao antebraço: direção exata, torção zero
    Rf = Matrix.Rotation(bend, 3, hinge) @ Ru
    twr = max(-70.0, min(70.0, tw))*(1 if s == "l" else -1)
    if abs(twr) > 1e-6: Rf = Matrix.Rotation(math.radians(twr), 3, fa) @ Rf
    return Ru, Rf


def hand_world(REST, s, Rf, hand_dir=None, max_deg=75.0):
    """Rotação de MUNDO da mão: a do antebraço + só DOBRA do punho até hand_dir (direção dos dedos), sem torção, limitada a max_deg."""
    if hand_dir is None: return Rf.copy()
    f_now = (Rf @ REST[f"hand_{s}"].to_3x3().col[1]).normalized(); hd = Vector(hand_dir).normalized()
    ang = f_now.angle(hd) if (f_now - hd).length > 1e-6 else 0.0
    if ang < 1e-5: return Rf.copy()
    ax = f_now.cross(hd)
    if ax.length < 1e-6: return Rf.copy()
    return Matrix.Rotation(min(ang, math.radians(max_deg)), 3, ax.normalized()) @ Rf


def arm_hand(REST, s, ua, fa, body_fwd, hand_dir=None, palm_dir=None, w=1.0, tw_prev=None, max_tw=88.0):
    """Braço + mão com a PALMA virada para palm_dir (ex.: para a cabeça, para o quadril). Sem girar o antebraço a palma só aponta para onde a
    dobradiça do cotovelo deixa (mãos "na cabeça" ficavam viradas para a frente, em pose de rendição). A pronação/supinação necessária é procurada
    em ±max_tw graus em torno do antebraço (continuidade: em empate fica a mais perto de tw_prev) e DIVIDIDA: metade no antebraço (cotovelo), metade
    no punho — sem ossos de torção, nenhuma das duas articulações passa de ~45°. w (0..1) mistura com a pose sem pronação.
    Devolve (Ru, Rf_osso, Hw, tw)."""
    Ru, Rf0 = arm_world(REST, s, ua, fa, body_fwd); fa = Vector(fa).normalized()
    if palm_dir is None or w <= 1e-4: return Ru, Rf0, hand_world(REST, s, Rf0, hand_dir), 0.0
    pd = Vector(palm_dir).normalized()
    def score(a):
        Rf = Matrix.Rotation(math.radians(a), 3, fa) @ Rf0; return (hand_world(REST, s, Rf, hand_dir) @ PALM0).dot(pd)
    cand = [a for a in range(-int(max_tw), int(max_tw) + 1, 4)]; best = max(score(a) for a in cand)
    near = [a for a in cand if score(a) >= best - .02]; a0 = min(near, key=lambda a: abs(a - (tw_prev if tw_prev is not None else 0)))
    for st in (2, 1, .5):                                            # refino local
        a0 = max((a0 - st, a0, a0 + st), key=lambda a: score(max(-max_tw, min(max_tw, a))))
    tw = max(-max_tw, min(max_tw, a0))*w
    Rf_full = Matrix.Rotation(math.radians(tw), 3, fa) @ Rf0; Rf_bone = Matrix.Rotation(math.radians(-tw/2), 3, fa) @ Rf_full
    return Ru, Rf_bone, hand_world(REST, s, Rf_full, hand_dir), tw


FINGERS = ("index", "middle", "ring", "pinky")
PUNHO_POLEGAR = ((-30, 5, 0), (0, 0, 10), (0, 0, 60))                  # (base: palma°, rumo ao mínimo°) e flexão das falanges 2 e 3 — busca em grade no esqueleto real
# graus por falange (01, 02, 03): relaxada = mão solta de jogador; punho = fechado sem atravessar a palma; aberta = dedos quase estendidos;
# cintura = mão no quadril: polegar ABERTO para trás (negativo = para o dorso da mão), contornando a cintura em vez de entrar nela;
# apoio = mão pousada numa superfície (cabeça): dedos levemente curvos e polegar AFASTADO da palma (negativo = abdução), para não entrar no que a palma toca
POSES = {"relaxada": (14, 20, 14), "punho": (68, 88, 52), "aberta": (4, 6, 4), "luva": (10, 14, 10), "apoio": (8, 12, 8), "cintura": (8, 14, 10)}
THUMB = {"relaxada": (8, 10, 8), "aberta": (-14, 0, 2), "luva": (6, 8, 6), "apoio": (24, 12, 6), "cintura": (-34, -6, 0)}


def finger_quats(REST, s, pose="relaxada", k=1.0):
    """Rotações LOCAIS (delta sobre o repouso) de todas as falanges de uma mão. pose: relaxada | punho | aberta | luva | aponta (indicador estendido).
    k (0..1) mistura com a mão relaxada — gestos entram e saem suavemente. Eixos tirados do REPOUSO de cada osso (não há rotação universal)."""
    out = {}
    knuck = (REST[f"pinky_01_{s}"].translation - REST[f"index_01_{s}"].translation).normalized()   # linha dos nós (do indicador ao mínimo)
    def blend(p):
        base = POSES["relaxada"]
        tgt = POSES["punho"] if p == "aponta" else POSES[p]
        return [b + (t - b)*k for b, t in zip(base, tgt)]
    for f in FINGERS:
        ang = blend(pose)
        if pose == "aponta" and f == "index": ang = [b + (t - b)*k for b, t in zip(POSES["relaxada"], (2, 3, 2))]
        for i, a in enumerate(ang, 1):
            nm = f"{f}_0{i}_{s}"; R0 = REST[nm].to_3x3(); d = R0.col[1].normalized(); ax = d.cross(PALM0)
            if ax.length < 1e-4: continue
            out[nm] = Quaternion((R0.inverted() @ ax).normalized(), math.radians(a))
    tb = THUMB["relaxada"]; tt = THUMB.get(pose, tb); tang = [b + (t - b)*k for b, t in zip(tb, tt)]
    for i, a in enumerate(tang, 1):                                   # polegar: fecha para a palma E atravessando-a (em direção ao mínimo)
        nm = f"thumb_0{i}_{s}"; R0 = REST[nm].to_3x3(); d = R0.col[1].normalized(); ax = d.cross((PALM0 + knuck*.8).normalized())
        if ax.length < 1e-4: continue
        out[nm] = Quaternion((R0.inverted() @ ax).normalized(), math.radians(a)) if pose not in ("punho", "aponta") else None
        if pose in ("punho", "aponta"):                               # punho: polegar POUSADO sobre o indicador e o médio fechados (pose resolvida por geometria,
            a1, b1, c = PUNHO_POLEGAR[i - 1]                          # tools/blender: ponta a ~2 mm do alvo, sem atravessar os dedos), misturado com o relaxado por k
            axp, axk = ((R0.inverted() @ d.cross(v)).normalized() for v in (PALM0, knuck))
            qf = Quaternion(axp, math.radians(a1)) @ Quaternion(axk, math.radians(b1)) if i == 1 else Quaternion(axp, math.radians(c*.5)) @ Quaternion(axk, math.radians(c))
            qr = Quaternion((R0.inverted() @ ax).normalized(), math.radians(THUMB["relaxada"][i - 1])); out[nm] = qr.slerp(qf, k)
    return out


def max_twist(arm_obj, REST, frames, sc, vl):
    """Verificação: maior torção (graus) do antebraço em relação ao braço e da mão em relação ao antebraço, em torno do eixo do osso filho."""
    worst = {}
    def tw(child, parent):
        pb = arm_obj.pose.bones; Mc, Mp = pb[child].matrix.to_3x3(), pb[parent].matrix.to_3x3()
        rel = (Mp @ REST[parent].to_3x3().inverted()).inverted() @ (Mc @ REST[child].to_3x3().inverted())   # rotação extra do filho além da do pai (mundo)
        ax = REST[child].to_3x3().col[1].normalized(); q = rel.to_quaternion(); p = q.x*ax.x + q.y*ax.y + q.z*ax.z
        a = abs(math.degrees(2*math.atan2(p, q.w))); return a if a <= 180 else 360 - a
    for f in frames:
        sc.frame_set(f); vl.update()
        for s in "lr":
            for k, (c, p) in {"antebraco": (f"lowerarm_{s}", f"upperarm_{s}"), "punho": (f"hand_{s}", f"lowerarm_{s}")}.items():
                v = tw(c, p); kk = f"{k}_{s}"
                if v > worst.get(kk, 0): worst[kk] = round(v, 1)
    return worst


# ---- COLISÃO das mãos com o corpo -------------------------------------------------------------------------------------------------------------------
# A pele (malha do corpo, sem cabelo/barba/acessórios) é guardada por osso: cada vértice vai para o osso que mais pesa nele (≥ wmin), em coordenadas de
# REPOUSO. Para medir um ponto da mão, ele é levado ao repouso pelo movimento rígido de cada osso e comparado com os vértices daquele osso (vértice mais
# próximo + normal média dos 8 vizinhos). É aproximado nas emendas (a pele real mistura ossos), mas pega o que importa: dedos dentro da cintura, da cabeça.
CORPO_OSSOS = ("Head", "neck_01", "spine_01", "spine_02", "spine_03", "pelvis", "thigh_l", "thigh_r")
MARGEM = .010                    # raio de um dedo: o eixo do dedo fica a 1 cm da pele, no mínimo


class Corpo:
    def __init__(self, meshes, arm_obj, ossos=CORPO_OSSOS, wmin=.6):
        from mathutils.kdtree import KDTree
        from mathutils.geometry import intersect_point_line
        bones = arm_obj.data.bones; self.REST, self.sets = {b.name: b.matrix_local.copy() for b in bones}, {}
        seg = {b: (bones[b].head_local.copy(), bones[b].tail_local.copy()) for b in ossos}
        pts = {b: [] for b in ossos}
        for o in meshes:
            if o.type != "MESH" or o.name.split("_")[0] in ("Hair", "Beard", "Must", "Side", "Acc", "Eyebrows", "Eyes"): continue
            gi = {g.index: g.name for g in o.vertex_groups}; R3 = o.matrix_world.to_3x3()
            for v in o.data.vertices:
                if not v.groups: continue
                g = max(v.groups, key=lambda g: g.weight); b = gi.get(g.group)
                if b not in pts or g.weight < wmin: continue
                co, n = o.matrix_world @ v.co, (R3 @ v.normal).normalized(); h, t = seg[b]
                c_, u = intersect_point_line(co, h, t); c_ = h if u < 0 else t if u > 1 else c_
                if n.dot(co - c_) <= 0: continue                     # face interna (barra/forro da camisa, boca): a normal aponta para dentro do membro
                pts[b].append((co, n))
        for b, P in pts.items():
            if not P: continue
            kd = KDTree(len(P))
            for i, (co, _) in enumerate(P): kd.insert(co, i)
            kd.balance(); self.sets[b] = (kd, P)

    def dist(self, M, p):
        """(distância com sinal à pele, normal no mundo, osso). M: matrizes de pose (armature) por osso. Negativa = dentro do corpo."""
        best = (1.0, Vector((0, 0, 1)), None)
        for b, (kd, P) in self.sets.items():
            Mb = M[b]; q = self.REST[b] @ (Mb.inverted() @ p); near = kd.find_n(q, 8); co, i, dd = near[0]
            if dd > .06: continue
            n = sum((P[j][1] for _, j, _ in near), Vector()).normalized(); d = (q - co).dot(n)
            if d < best[0]: best = (d, ((Mb.to_3x3() @ self.REST[b].to_3x3().inverted()) @ n).normalized(), b)
        return best


DEDO_PONTOS = [(f"{d}_0{i}", t) for d in ("index", "middle", "ring", "pinky", "thumb") for i, t in ((2, 0), (3, 0), (3, 1))]


def pontos_mao(arm_obj, s, M=None):
    """Juntas e pontas dos dedos de uma mão (coordenadas do armature) — os pontos testados contra a pele."""
    out = []
    for nm, t in DEDO_PONTOS:
        nm = f"{nm}_{s}"; m = M[nm] if M else arm_obj.pose.bones[nm].matrix; out.append(m @ Vector((0, arm_obj.data.bones[nm].length*t, 0)))
    return out


def colisao_mao(arm_obj, corpo, s, M=None):
    """Pior ponto da mão contra o corpo: (distância, normal, osso)."""
    P = pontos_mao(arm_obj, s, M); M = M or {b: arm_obj.pose.bones[b].matrix for b in corpo.sets}
    return min((corpo.dist(M, p) for p in P), key=lambda r: r[0])


def anticolisao(arm_obj, REST, corpo, frames, sc, vl, ciclos=6):
    """PÓS-PROCESSO de um clipe já em FK (depois do bake): onde uma junta de dedo fica a menos de MARGEM da pele, o punho é empurrado para fora pela normal
    com IK de 2 ossos (cotovelo no mesmo plano) e o braço é re-chaveado com arm_world (cotovelo-dobradiça, frente do tronco = spine_03). A mão mantém a
    rotação LOCAL (sem torção nova). O empurrão é suavizado no tempo (o maior em ±2 quadros, depois média de ±4) e o ciclo se repete até não haver contato.
    Devolve {"empurrao_cm": {...}, "ciclos": n, "pior_mm": ...}."""
    pb = arm_obj.pose.bones; F = list(frames); n = len(F)
    LU = (REST["lowerarm_r"].translation - REST["upperarm_r"].translation).length; LF = (REST["hand_r"].translation - REST["lowerarm_r"].translation).length
    base = []
    for f in F:
        sc.frame_set(f); vl.update()
        base.append({s: ((pb[f"lowerarm_{s}"].head - pb[f"upperarm_{s}"].head).normalized(), (pb[f"hand_{s}"].head - pb[f"lowerarm_{s}"].head).normalized()) for s in "lr"})
    PUSH = {s: [Vector()]*n for s in "lr"}
    def ik(Sv, Wv, pole):
        d = Wv - Sv; L_ = min(d.length, LU + LF - 1e-3); nn = d.normalized(); a_ = (LU*LU - LF*LF + L_*L_)/(2*L_); h_ = math.sqrt(max(0, LU*LU - a_*a_))
        p_ = pole - Sv; p_ = (p_ - nn*p_.dot(nn)).normalized(); return Sv + nn*a_ + p_*h_, Sv + nn*L_
    def setw(name, R):
        vl.update(); b = pb[name]; M = (R @ REST[name].to_3x3()).to_4x4(); M.translation = b.head.copy(); b.matrix = M
    def aplica(i):
        sc.frame_set(F[i]); vl.update(); Rc = pb["spine_03"].matrix.to_3x3() @ REST["spine_03"].to_3x3().inverted()
        for s in "lr":
            if PUSH[s][i].length < 1e-6: continue
            ua, fa = base[i][s]; Sv = pb[f"upperarm_{s}"].head.copy(); E0 = Sv + ua*LU; W0 = E0 + fa*LF
            E_, W2 = ik(Sv, W0 + PUSH[s][i], E0 + (E0 - (Sv + W0)/2)*2); Ru, Rf = arm_world(REST, s, E_ - Sv, W2 - E_, Rc @ FWD0)
            setw(f"upperarm_{s}", Ru); setw(f"lowerarm_{s}", Rf)
            for b in (f"upperarm_{s}", f"lowerarm_{s}"): pb[b].keyframe_insert("rotation_quaternion", frame=F[i], group=b)
    pior, c = 1.0, 0
    for c in range(ciclos):
        R = {s: [Vector()]*n for s in "lr"}; pior = 1.0
        for i, f in enumerate(F):
            sc.frame_set(f); vl.update()
            for s in "lr":
                d, nrm, _ = colisao_mao(arm_obj, corpo, s); pior = min(pior, d)
                if d < MARGEM: R[s][i] = nrm*(MARGEM - d + .004)
        if pior >= MARGEM - .002: break
        for s in "lr":
            Dl = [max(R[s][max(0, i - 2):i + 3], key=lambda v: v.length) for i in range(n)]
            A = [sum(Dl[max(0, i - 4):i + 5], Vector())/len(Dl[max(0, i - 4):i + 5]) for i in range(n)]
            PUSH[s] = [(PUSH[s][i] + A[i]) if (PUSH[s][i] + A[i]).length <= .15 else (PUSH[s][i] + A[i])*(.15/(PUSH[s][i] + A[i]).length) for i in range(n)]
        for i in range(n): aplica(i)
    return {"empurrao_cm": {s: round(max(v.length for v in PUSH[s])*100, 1) for s in "lr"}, "ciclos": c, "pior_mm": round(pior*1000, 1)}
