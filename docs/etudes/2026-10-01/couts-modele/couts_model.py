"""Modèle de coûts IA de Tom. Toutes les entrées sont listées en tête ; chaque
valeur est marquée M (mesuré), S (sourcé) ou H (hypothèse) dans couts.md."""
from dataclasses import dataclass, field

# ---- Prix (S) en $ list / M tokens ; facturés x1.1 sur l'endpoint UE (S)
P_IN, P_OUT, CACHE = 0.15, 0.60, 0.10
P_EMB = 0.10
P_STT_MIN = 0.003
P_TTS_MCHAR = 16.0
EU = 1.1
FX = 1.0          # H : 1 $ list = 1 € facturé (parité prudente) ; alternative BCE 0.8807

# ---- Tailles (M = mesuré au tokenizer Small 4, H = hypothèse)
PREFIX = 3170     # M : system prompt + 4 outils + gabarit (3108-3212 avec un message de 33)
U = 40            # H : message élève enveloppé (M : 33 pour une question de 60 caractères)
A = 250           # H : réponse de Tom (M : 76 et 180 sur deux tours réels)
CTX = 150         # H : bloc <student_context> (profil + révisions)
R = 1000          # H : tokens de raisonnement quand reasoningEffort=high
P_REASON = 0.17   # H : part des tours en high (4e/3e x maths-sciences x intention difficile)
P_TOOL_T1 = 0.5   # H : get_student_profile appelé au 1er tour
P_TOOL_UPD = 0.1  # H : update_student_profile par tour
SUMMARY = 1200    # H : résumé de conversation (plafond 2048 tokens / 6000 caractères)
IMG = 2352        # M : photo de téléphone 4032x3024 au tokenizer Small 4
ANALYSIS = 600    # H : analyse de document réinjectée à chaque tour suivant de la séance
VISION_IN = 101 + 55 + 150 + IMG  # M (prompts) + H (schéma JSON 150)
VISION_OUT = 800  # H
INTENT_IN, INTENT_OUT = 249 + 20 + 90, 25  # M (prompt) + H (message, schéma, sortie)
TITLE_IN, TITLE_OUT = 207 + 230, 15         # M (prompt) + H (500+300 caractères)
SUMM_PROMPT = 286                           # M
STT_MIN = 0.25    # H : 15 s d'audio par tour vocal
CHARS_PER_TOK = 3.4  # M : 3.37 sur une réponse type, 3.6 sur le system prompt
VOICE_A = 150     # H : réponse plus courte en mode [VOCAL]


def eur(inp, cached=0, out=0):
    return ((inp - cached) * P_IN + cached * P_IN * CACHE + out * P_OUT) / 1e6 * EU * FX


@dataclass
class Turn:
    quota: float = 0.0      # totalTokens compté par le quota (chat seulement)
    chat: float = 0.0
    aux: float = 0.0        # classifieur, embedding, titre, résumé, vision
    audio: float = 0.0      # STT + TTS
    inp: float = 0.0
    cached: float = 0.0
    out: float = 0.0


def session(turns, photo=False, voice_share=0.0, reasoning=P_REASON, tool_t1=P_TOOL_T1,
            tts_all=False):
    """Coût espéré d'une séance de `turns` tours (espérance sur les probabilités)."""
    res = []
    msgs = 0
    for n in range(1, turns + 1):
        t = Turn()
        a = A * (1 - voice_share) + VOICE_A * voice_share
        extra = ANALYSIS if photo else 0
        img = IMG if (photo and n == 1) else 0
        if n <= 10:
            hist = (n - 1) * (U + A)
            inp = PREFIX + hist + CTX + extra + img + U
            cached = 0 if n == 1 else PREFIX + max(0, n - 2) * (U + A)
        else:
            hist = SUMMARY + 5 * (U + A)
            inp = PREFIX + hist + CTX + extra + U
            cached = PREFIX  # fenêtre glissante + résumé réécrit à chaque tour
        out = a + reasoning * R
        # étapes d'outil : la 2e étape relit la 1re depuis le cache
        p_tool = (tool_t1 if n == 1 else 0) + P_TOOL_UPD
        tool_in = p_tool * (inp + 60 + 150)
        tool_cached = p_tool * inp
        tool_out = p_tool * 40
        t.inp, t.cached, t.out = inp + tool_in, cached + tool_cached, out + tool_out
        t.quota = t.inp + t.out
        t.chat = eur(t.inp, t.cached, t.out)
        aux = eur(INTENT_IN, 0.6 * 249, INTENT_OUT) + U * P_EMB / 1e6 * EU * FX
        if n == 1:
            aux += eur(TITLE_IN, 0, TITLE_OUT)
            if photo:
                aux += eur(VISION_IN, 0, VISION_OUT)
        msgs += 2
        if msgs >= 20:  # résumé : 1er au 10e tour puis à chaque tour (seuil incrémental toujours franchi)
            to_sum = (msgs - 10) * (U + A) / 2
            prev = SUMMARY if msgs > 20 else 0
            aux += eur(SUMM_PROMPT + prev + to_sum, SUMM_PROMPT * 0.8, SUMMARY)
        t.aux = aux
        tts_chars = (a if tts_all else voice_share * VOICE_A) * CHARS_PER_TOK
        t.audio = (voice_share * STT_MIN * P_STT_MIN + tts_chars * P_TTS_MCHAR / 1e6) * EU * FX
        res.append(t)
    return res


def tot(ts, k):
    return sum(getattr(t, k) for t in ts)


def quota_turns(window, daily, turns_seq):
    """Nombre de tours accordés : le contrôle a lieu AVANT le tour (dépassement possible)."""
    w = d = 0
    n = 0
    for q in turns_seq:
        if w >= window or d >= daily:
            break
        w += q
        d += q
        n += 1
    return n, w


WEEKS = 52 / 12   # semaines par mois
PHOTO_SESSIONS = 0.25  # H
VOICE = 0.10           # H
PLANS = {'gratuit': (5_000, 15_000), 'complet': (25_000, 75_000)}
PROFILES = {'léger': (2, 3), 'normal': (4, 6), 'intensif': (6, 12)}


def seance_cost(turns, plan=None, **kw):
    """Coût d'une séance (mélange photo/non-photo), tours bornés par la fenêtre du plan."""
    tot_c = {'chat': 0, 'aux': 0, 'audio': 0, 'quota': 0, 'turns': 0}
    for photo, w in ((True, PHOTO_SESSIONS), (False, 1 - PHOTO_SESSIONS)):
        s = session(turns, photo=photo, voice_share=kw.get('voice', VOICE), reasoning=kw.get('reasoning', P_REASON),
                    tool_t1=kw.get('tool_t1', P_TOOL_T1), tts_all=kw.get('tts_all', False))
        n = turns
        if plan:
            n, _ = quota_turns(*PLANS[plan], [t.quota for t in s])
        s = s[:n]
        for k in ('chat', 'aux', 'audio', 'quota'):
            tot_c[k] += w * tot(s, k)
        tot_c['turns'] += w * n
    tot_c['total'] = tot_c['chat'] + tot_c['aux'] + tot_c['audio']
    return tot_c


def month(profile, plan=None, **kw):
    per_week, turns = PROFILES[profile]
    c = seance_cost(turns, plan, **kw)
    m = {k: v * per_week * WEEKS for k, v in c.items()}
    return m


def cap_day(plan, photo=False, tts_all=False, voice=VOICE, reasoning=P_REASON, tool_t1=P_TOOL_T1):
    """Jour au plafond : séances enchaînées jusqu'au blocage de fenêtre, nouvelle fenêtre, jusqu'au plafond quotidien."""
    window, daily = PLANS[plan]
    d = 0; cost = 0; turns = 0; windows = 0
    while d < daily and windows < 5:
        s = session(30, photo=photo, voice_share=voice, reasoning=reasoning, tool_t1=tool_t1, tts_all=tts_all)
        w = 0; windows += 1
        for t in s:
            if w >= window or d >= daily:
                break
            w += t.quota; d += t.quota; turns += 1
            cost += t.chat + t.aux + t.audio
    return cost, turns, d, windows


if __name__ == '__main__':
    print('== tour par tour (séance de 12, texte, espérance)')
    for i, t in enumerate(session(12), 1):
        print(i, round(t.inp), round(t.cached), round(t.out), round(t.quota), f"chat {t.chat*100:.4f}c aux {t.aux*100:.4f}c")
    print('== types de tour (tour 2 d une séance)')
    txt = session(2)[1]; print('texte', txt.chat + txt.aux)
    ph = session(1, photo=True)[0]; print('photo t1', ph.chat, ph.aux, ph.quota)
    ph2 = session(2, photo=True)[1]; print('photo suite', ph2.chat + ph2.aux)
    vo = session(2, voice_share=1.0)[1]; print('voix', vo.chat, vo.aux, vo.audio)
    print('== profils / mois (non borné, gratuit, complet)')
    for p in PROFILES:
        for plan in (None, 'gratuit', 'complet'):
            m = month(p, plan)
            print(p, plan, {k: round(v, 4) for k, v in m.items()})
    print('== plafonds / jour puis x30')
    for plan in PLANS:
        for kw in ({}, {'photo': True}, {'photo': True, 'tts_all': True}):
            c, n, d, w = cap_day(plan, **kw)
            print(plan, kw, 'tours/j', n, 'quota', round(d), 'fenêtres', w, '€/j', round(c, 4), '€/30j', round(c * 30, 3))
    print('== fenêtre unique (soirée 17h-22h)')
    for plan in PLANS:
        s = session(30)
        n, w = quota_turns(PLANS[plan][0], PLANS[plan][1], [t.quota for t in s])
        print(plan, 'tours dans une fenêtre', n, round(w))
    print('== sensibilités, profil normal complet')
    base = month('normal', 'complet')['total']
    for name, kw in {'R=3000': None, 'reasoning off': {'reasoning': 0}, 'TTS sur toutes les réponses': {'tts_all': True}, 'voix 0': {'voice': 0}, 'voix 50%': {'voice': 0.5}}.items():
        if kw is None:
            import couts_model as cm
            g = globals(); old = g['R']; g['R'] = 3000; v = month('normal', 'complet')['total']; g['R'] = old
        else:
            v = month('normal', 'complet', **kw)['total']
        print(name, round(v, 4), 'vs', round(base, 4))
