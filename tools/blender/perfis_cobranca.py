# Perfis das cobranças: TIPO (mecânica do chute) × ESTILO (rotina de aproximação). Lido por tools/blender/cobranca.py.
# Espaço do clipe (Blender): bola em (0, 0, 0.11); gol em -Y; esquerda do jogador = +X; perna de chute = DIREITA (o canhoto é o espelho, feito no fim).
# Tempos em segundos relativos ao CONTATO (tc = 0). Ângulos em graus.
#
# TIPOS (base biomecânica):
#  - medio  = o chute de peito do pé que já existia (tools/blender/chute.py), mantido como referência.
#  - chapada: chute com a parte interna do pé. Nunome et al. 2002 (Med Sci Sports Exerc 34:2028): bola mais lenta que a de peito do pé
#    (23,4 vs 28,0 m/s no máximo) e rotação EXTERNA do quadril bem maior, que gira o plano coxa–canela para o lado interno do pé bater de frente na bola;
#    Nunome et al. 2025 (Sports Biomech): no chute submáximo o tornozelo é fixado e a velocidade é regulada; corrida mais curta e controlada.
#  - bomba: peito do pé com mais embalo — corrida maior e progressiva, última passada longa, extensão do quadril e flexão do joelho maiores no recuo,
#    arco de tensão (tronco torcido e braço oposto abduzido) e acompanhamento amplo (Shan & Westerhoff 2005; Augustus et al. 2024).
#
# ESTILOS (direção artística a partir das reportagens; nada aqui é medição do atleta, exceto onde indicado):
#  - neymar: ge.globo "O pênalti de Neymar passo a passo": entra pela esquerda, ~3 m em menos de 2 s alternando rapidamente o tamanho dos passos,
#    reduz a velocidade para provocar a reação do goleiro e decide depois de ver o lado escolhido → passos curtos/longos alternados, desaceleração, cabeça no goleiro.
#  - gabigol: ge.globo/Esporte Espetacular (estudo Unicamp/USP/UEL, 2021): ângulo de aproximação 25,6°, ~9 m de distância, velocidade máxima ~8 km/h,
#    observa o goleiro antes de tocar na bola → corrida longa e calma, hesitação curta perto da bola olhando o goleiro, depois acelera. Canhoto (elenco).
#  - jorginho: ge.globo (11/03/2026): o "pulinho" surgiu quando ia fazer a paradinha e "pulei, por instinto, e bati"; "é uma questão de timing" →
#    aproximação controlada, reduz o ritmo, pulinho sobre o pé de apoio que aterrissa ao lado da bola e já transfere o peso para o chute.
#  - arrascaeta: perfil ORIGINAL (direção artística pedida, sem medição do atleta): preparação econômica, passadas controladas, chute compacto.

TIPOS_SUPORTADOS = {e: ("chapada", "medio", "bomba") for e in ("comum", "canhoto", "neymar", "gabigol", "jorginho", "arrascaeta")}   # o tipo vem da barra de força
# "canhoto" = a cobrança comum batida com a ESQUERDA (espelho exato da pose do destro), usada por todo jogador canhoto sem rotina própria
PE = {"comum": "r", "canhoto": "l", "neymar": "r", "gabigol": "l", "jorginho": "r", "arrascaeta": "r"}   # pé de chute (Transfermarkt / elenco do jogo)


# AJUSTES A PARTIR DA REFERÊNCIA VISUAL "Penalty" (Centroid Motion Capture, Sketchfab): o modelo NÃO é baixável e não tem licença declarada, então
# nada foi copiado — só observado no visualizador oficial (vista lateral e frontal, 10,2–12,0 s). Princípios aplicados, com intensidade por tipo:
#  1) penúltima passada em "salto" (voo antes do plantio): a pelve sobe no ar entre a saída do pé de chute e o pouso do pé de apoio;
#  2) braço oposto à perna de chute vai para a frente e para fora JÁ na penúltima passada (contrapeso), e não só no plantio;
#  3) tronco mais ereto no contato (menos inclinado para a frente) e mais inclinado para o lado do pé de apoio;
#  4) depois do contato o jogador NÃO trava: pousa sobre a perna de chute e segue andando para a frente (mais deslocamento na recuperação).
REF = {"chapada": dict(voo=.010, braco=.6, ereto=3, lado=1, segue=1.15), "medio": dict(voo=.035, braco=1.0, ereto=10, lado=4, segue=1.35),
       "bomba": dict(voo=.045, braco=1.15, ereto=13, lado=5, segue=1.25)}


def _referencia(nome, d):
    r = REF[nome]; d = dict(d)
    k0 = min(d["pre_pel"]); a_, n_, z = d["pre_pel"][k0]; d["pre_pel"] = d["pre_pel"] | {k0: (a_, n_, z + r["voo"])}                    # 1) voo
    l = dict(d["pre_arms"]["l"]); g = r["braco"]                                                                                        # 2) contrapeso cedo
    l[min(l)] = ((.55*g, -.45, -.70), (.5*g, -.75, -.1)); l[-.12] = ((.78*g, -.30, -.40 + .2*(g - 1)), (.80*g, -.50, .05))
    d["pre_arms"] = d["pre_arms"] | {"l": l}
    d["crot"] = {t: (v[0], v[1] - r["ereto"]*(1 if -.07 <= t <= .13 else .5 if t <= .3 else 0), v[2] + r["lado"]*(1 if -.07 <= t <= .13 else 0)) for t, v in d["crot"].items()}   # 3)
    kl = d["kick_land"]; yl = d["pel"][min(d["pel"], key=lambda t: abs(t - kl))][1]; f = r["segue"]                                     # 4) segue em frente
    d["pel"] = {t: (v[0], (yl + (v[1] - yl)*f) if t > kl else v[1], v[2]) for t, v in d["pel"].items()}
    rec = dict(d["rec"]); rec["L5"] = (rec["L5"][0], yl + (rec["L5"][1] - yl)*f); rec["R5"] = (rec["R5"][0], yl + (rec["R5"][1] - yl)*f)
    rec["r_step"] = (kl + (rec["r_step"][0] - kl)/f, rec["r_step"][1]); d["rec"] = rec                                                # com mais avanço o pé de chute sai antes
    return d


def tipo(nome):
    return _referencia(nome, _tipo(nome))


def _tipo(nome):
    """Parâmetros do chute. Posições de chave são relativas ao pé de apoio PL e à direção da corrida (A = frente, N = esquerda), salvo as do contato em diante."""
    if nome == "medio":
        return dict(
            AP=-35, PL=(.26, .06), last=1.35, lat=.18, tR3=-.40, kick_off=-.233, plant=-.117, kick_land=.40, T1=1.0,
            gait=-.47, zs=.88, zf=.93, lean=12, sway=3, armk=1.0,
            # pré-plantio: (dt a partir do plantio) → pelve (a, n, z) = PL - A*a - N*n ; rotações relativas ao AP
            pre_pel={-.063: (.747, .084, .92), 0: (.46, .02, .88)},
            pre_prot={"off": (-13, 6, 0), 0: (-20, 0, 8)}, pre_crot={"off": (10, 5, 5), 0: (15, -8, 14)},
            pre_arms={"l": {-.20: ((.25, -.5, -.83), (0, -.85, .4)), -.053: ((.6, .3, -.3), (.7, .1, -.2)), 0: ((.85, .35, .15), (.9, .2, .15))},
                      "r": {-.20: "BACK", -.083: ((-.25, -.45, -.85), (-.1, -.85, -.3)), 0: ((-.3, -.55, -.75), (-.1, -.8, -.4))}},
            pre_ang={-.063: (-20, -95)}, pre_pitch={-.063: 80},
            # do plantio em diante (tempos absolutos)
            pel={-.06: (.44, .40, .87), 0: (.38, .34, .88), .12: (.25, .04, .90), .24: (.17, -.20, .97), .40: (.08, -.44, .88),
                 .50: (.07, -.62, .88), .60: (.06, -.76, .89), .72: (.05, -.86, .91), .86: (.05, -.935, .925), .94: (.05, -.95, .93), 1.0: (.05, -.95, .93)},
            prot={-.06: (-35, 4, 12), 0: (-10, 8, 15), .12: (5, 8, 8), .20: (9, -4, 4), .28: (10, 0, 2), .40: (8, 10, 0), .60: (4, 6, 0), 1.0: (0, 4, 0)},
            crot={-.06: (-22, 4, 18), 0: (-25, 18, 18), .12: (-2, 18, 10), .20: (6, 2, 5), .28: (8, 6, 3), .40: (6, 16, 0), .60: (2, 9, 0), 1.0: (0, 6, 0)},
            head={0: 40, .12: 30, .24: 18, .45: 8, 1.0: 5},
            arms={"l": {-.06: ((.9, .05, .2), (.85, -.35, .25)), 0: ((.9, -.2, .1), (.7, -.6, .1)), .12: ((.55, -.7, -.35), (.15, -.85, -.3)), .26: ((.45, -.45, -.75), (.2, -.75, -.5)),
                        .40: ((.55, -.15, -.8), (.35, -.55, -.7)), .60: ((.3, -.05, -.95), (.2, -.35, -.9)), 1.0: "RELAX"},
                  "r": {-.06: ((-.4, -.1, -.85), (-.25, -.4, -.8)), 0: ((-.45, .4, -.8), (-.3, .1, -.95)), .12: ((-.5, .25, -.82), (-.4, -.25, -.85)), .26: ((-.6, .05, -.8), (-.45, -.4, -.75)),
                        .40: ((-.5, -.1, -.85), (-.3, -.45, -.82)), .60: ((-.3, -.05, -.95), (-.2, -.35, -.9)), 1.0: "RELAX"}},
            ang={"plant": (-18, -118), -.085: (-5, -128), -.05: (18, -105), -.025: (32, -60), .04: ("C", 16, 42), .10: (78, 66), .17: (95, 86), .24: (88, 70), .31: (52, 30), .37: (22, 5)},
            pitch={"plant": 110, -.085: 115, -.05: 100, -.025: 75, 0: 60, .10: 50, .17: 40, .24: 30, .31: 15},
            psi={"plant": 3, -.05: -22, 0: -8, .10: -3, .24: 0}, beta={"plant": .6, 0: 1, .17: .4, .31: 0},
            footyaw={}, contact=dict(kind="peito", off=(0, .13, .125)),
            rec=dict(R4=(-.08, -.52), L5=(.20, -.98), R5=(-.10, -.92), l_step=(.16, .52), r_step=(.60, .86)))
    if nome == "bomba":
        return dict(
            AP=-40, PL=(.27, .10), last=1.60, lat=.20, tR3=-.44, kick_off=-.26, plant=-.13, kick_land=.47, T1=1.15,
            gait=-.50, zs=.87, zf=.94, lean=15, sway=4, armk=1.1,
            pre_pel={-.07: (.86, .09, .93), 0: (.52, .02, .87)},
            pre_prot={"off": (-15, 8, 0), 0: (-26, -4, 10)}, pre_crot={"off": (12, 6, 6), 0: (20, -12, 16)},
            pre_arms={"l": {-.22: ((.3, -.55, -.78), (0, -.85, .45)), -.06: ((.7, .35, -.2), (.8, .15, -.1)), 0: ((.92, .35, .2), (.95, .2, .2))},
                      "r": {-.22: "BACK", -.09: ((-.3, -.45, -.85), (-.1, -.85, -.3)), 0: ((-.35, -.6, -.7), (-.1, -.8, -.4))}},
            pre_ang={-.07: (-28, -100)}, pre_pitch={-.07: 85},
            pel={-.065: (.47, .45, .86), 0: (.40, .36, .87), .12: (.27, .02, .91), .26: (.17, -.30, .99), .47: (.06, -.66, .87),
                 .58: (.07, -.90, .87), .70: (.06, -1.10, .89), .84: (.05, -1.20, .91), .98: (.05, -1.29, .925), 1.08: (.05, -1.30, .93), 1.15: (.05, -1.30, .93)},
            prot={-.065: (-38, 6, 14), 0: (-8, 10, 16), .12: (8, 8, 9), .22: (11, -6, 4), .32: (12, -2, 2), .47: (8, 12, 0), .70: (4, 6, 0), 1.15: (0, 4, 0)},
            crot={-.065: (-24, 6, 20), 0: (-28, 22, 20), .12: (-2, 22, 11), .22: (8, 0, 5), .32: (10, 4, 3), .47: (7, 18, 0), .70: (2, 9, 0), 1.15: (0, 6, 0)},
            head={0: 42, .12: 32, .26: 16, .50: 8, 1.15: 5},
            arms={"l": {-.065: ((.95, .1, .25), (.9, -.35, .3)), 0: ((.92, -.2, .15), (.7, -.65, .15)), .12: ((.6, -.7, -.3), (.2, -.85, -.25)), .28: ((.5, -.5, -.7), (.25, -.75, -.45)),
                        .47: ((.6, -.15, -.78), (.4, -.55, -.68)), .70: ((.3, -.05, -.95), (.2, -.35, -.9)), 1.15: "RELAX"},
                  "r": {-.065: ((-.45, -.1, -.85), (-.3, -.4, -.8)), 0: ((-.5, .45, -.75), (-.35, .15, -.92)), .12: ((-.55, .3, -.78), (-.45, -.2, -.85)), .28: ((-.65, .05, -.75), (-.5, -.4, -.72)),
                        .47: ((-.55, -.1, -.82), (-.35, -.45, -.8)), .70: ((-.3, -.05, -.95), (-.2, -.35, -.9)), 1.15: "RELAX"}},
            ang={"plant": (-26, -126), -.075: (-12, -136), -.045: (14, -116), -.022: (34, -64), .04: ("C", 20, 48), .10: (86, 74), .18: (104, 94), .26: (98, 82), .34: (64, 42), .42: (26, 6)},
            pitch={"plant": 112, -.075: 118, -.045: 104, -.022: 80, 0: 66, .10: 55, .18: 44, .26: 34, .34: 18},
            psi={"plant": 3, -.045: -24, 0: -8, .10: -3, .26: 0}, beta={"plant": .6, 0: 1, .18: .4, .34: 0},
            footyaw={}, contact=dict(kind="peito", off=(0, .13, .125)),
            rec=dict(R4=(-.10, -.80), L5=(.22, -1.36), R5=(-.10, -1.30), l_step=(.22, .66), r_step=(.74, .98)))
    if nome == "chapada":
        return dict(
            AP=-30, PL=(.22, .04), last=1.05, lat=.16, tR3=-.42, kick_off=-.25, plant=-.15, kick_land=.34, T1=1.0,
            gait=-.20, zs=.89, zf=.92, lean=8, sway=2, armk=.7,
            pre_pel={-.06: (.62, .06, .91), 0: (.40, .02, .89)},
            pre_prot={"off": (-8, 5, 0), 0: (-10, 3, 5)}, pre_crot={"off": (5, 4, 3), 0: (8, 2, 7)},
            pre_arms={"l": {-.17: ((.25, -.45, -.85), (0, -.85, .35)), -.05: ((.55, .15, -.6), (.6, -.1, -.4)), 0: ((.7, .2, -.35), (.7, -.15, -.25))},
                      "r": {-.17: "BACK", -.05: ((-.3, -.3, -.88), (-.15, -.75, -.6)), 0: ((-.32, -.35, -.85), (-.15, -.75, -.6))}},
            pre_ang={-.06: (-8, -70)}, pre_pitch={-.06: 45},
            pel={-.05: (.36, .34, .89), 0: (.32, .30, .895), .10: (.26, .12, .905), .20: (.20, -.05, .91), .34: (.12, -.22, .90),
                 .46: (.10, -.36, .905), .58: (.09, -.50, .915), .72: (.08, -.60, .925), .86: (.08, -.65, .93), 1.0: (.08, -.65, .93)},
            prot={-.05: (-22, 4, 7), 0: (-12, 6, 7), .10: (-4, 6, 4), .20: (0, 4, 2), .34: (2, 5, 0), .58: (1, 4, 0), 1.0: (0, 4, 0)},
            crot={-.05: (-14, 6, 8), 0: (-12, 9, 7), .10: (-6, 9, 4), .20: (-2, 7, 2), .34: (0, 7, 0), .58: (0, 6, 0), 1.0: (0, 6, 0)},
            head={0: 42, .10: 36, .22: 22, .45: 10, 1.0: 5},
            arms={"l": {-.05: ((.72, .15, -.35), (.72, -.2, -.25)), 0: ((.7, .05, -.4), (.65, -.35, -.3)), .12: ((.55, -.25, -.65), (.4, -.6, -.5)),
                        .30: ((.4, -.15, -.85), (.3, -.5, -.75)), .58: ((.3, -.05, -.95), (.2, -.35, -.9)), 1.0: "RELAX"},
                  "r": {-.05: ((-.35, -.25, -.88), (-.2, -.7, -.65)), 0: ((-.4, -.05, -.9), (-.25, -.5, -.8)), .12: ((-.4, .1, -.9), (-.3, -.35, -.85)),
                        .30: ((-.35, 0, -.92), (-.25, -.4, -.85)), .58: ((-.3, -.05, -.95), (-.2, -.35, -.9)), 1.0: "RELAX"}},
            # pêndulo curto: coxa pouco recuada, joelho ~75–85°; acompanhamento BAIXO, perna quase não sobe
            ang={"plant": (-10, -84), -.10: (-6, -82), -.06: (4, -66), -.03: (13, -42), .05: ("C", 8, 14), .12: (36, 24), .20: (34, 20), .27: (20, 8)},
            pitch={"plant": 40, -.06: 18, -.03: 4, 0: -2, .12: -2, .20: -5, .27: -6},
            psi={"plant": 3, -.06: -8, 0: -4, .12: -2, .24: 0}, beta={"plant": .3, 0: 1, .12: .5, .27: 0},
            # rotação externa do quadril: o pé gira para fora (dedos para a direita) e a parte INTERNA encara a bola
            footyaw={"off": 0, -.11: -35, -.06: -72, 0: -82, .08: -74, .18: -40, .27: -12},
            contact=dict(kind="chapa", off=(.07, .16, .0)),
            rec=dict(R4=(-.06, -.40), L5=(.18, -.68), R5=(-.10, -.64), l_step=(.36, .62), r_step=(.70, .90)))
    raise KeyError(nome)


def estilo(nome, t):
    e = _estilo(nome, t)
    if nome not in ("comum", "canhoto"):                             # o craque mantém o ritmo, mas a força muda a pressa: chapada controlada, bomba agressiva
        k = 1.12 if t["last"] <= 1.1 else .86 if t["last"] >= 1.5 else 1.0
        e = e | dict(passos=[(d, dt*k) for d, dt in e["passos"]])
    return e


def _estilo(nome, t):
    """Rotina de aproximação. passos = [(distância até o PRÓXIMO apoio, tempo até o próximo toque)] do 1º apoio até o último antes de R3 (pé de chute na última passada).
    inicio = distância da posição parada ao 1º apoio. olhar = janelas (tc0, tc1) em que a cabeça mira o goleiro."""
    base = dict(AP=-35, gait=t["gait"], zs=t["zs"], zf=t["zf"], lean=t["lean"], sway=t["sway"], arms=t["armk"], amp=1.0, olhar=(), hesita=0, pulinho=False, ajustes=0)
    if nome in ("comum", "canhoto"):
        if t["last"] >= 1.5:   # bomba: do mesmo ponto, passadas mais longas e rápidas (corrida agressiva), última passada longa
            return base | dict(inicio=.60, passos=[(.80, .25), (1.0, .21)])
        if t["last"] <= 1.1:   # chapada: do mesmo ponto, passos curtos, controlados e mais lentos
            return base | dict(inicio=.60, passos=[(.62, .36), (.74, .34), (.80, .32)])
        return base | dict(inicio=.60, passos=[(.90, .29), (1.10, .26)])
    if nome == "neymar":       # passos curtos e longos alternados, desaceleração, cabeça no goleiro, pequenos ajustes do corpo
        return base | dict(AP=-41, gait=.05, zs=.93, zf=.905, lean=6, sway=4, arms=.8, inicio=.35, ajustes=3,
                           passos=[(.55, .26), (.30, .22), (.60, .28), (.28, .26), (.55, .32), (.32, .34), (.50, .40), (.62, .44)],
                           olhar=((-2.4, -1.5), (-1.1, -.55)))
    if nome == "gabigol":      # longe da bola (~9 m), ângulo ~25,6°, corrida calma e longa, hesitação curta perto da bola
        return base | dict(AP=-25.6, gait=-.18, zs=.90, zf=.925, lean=7, sway=3, arms=.75, inicio=.50, hesita=.34,
                           passos=[(.70, .40), (.85, .40), (.95, .40), (.95, .40), (.95, .41), (.90, .42), (.85, .42), (.55, .44), (.55, .36)],
                           olhar=((-1.5, -.40),))
    if nome == "jorginho":     # controlada, reduz o ritmo, pulinho antes do plantio
        return base | dict(AP=-30, gait=-.10, zs=.90, zf=.925, lean=8, sway=3, arms=.85, inicio=.45, pulinho=True,
                           passos=[(.75, .32), (.80, .34), (.70, .36)], olhar=((-1.0, -.45),))
    if nome == "arrascaeta":   # econômico e compacto
        return base | dict(AP=-32, gait=-.35, zs=.89, zf=.925, lean=9, sway=2, arms=.7, amp=.86, inicio=.45,
                           passos=[(.75, .30), (.95, .27)])
    raise KeyError(nome)
