import couts_model as m, infra
import sys
f = lambda x, d=4: f"{x:.{d}f}".replace('.', ',')
c = lambda x: f"{x*100:.3f}".replace('.', ',')  # centimes

m.P_TOOL_UPD = 0
print('### T1 tour type')
rows = []
def row(name, t, extra_aux=0):
    print(f"| {name} | {round(t.inp)} | {round(t.cached)} | {round(t.out)} | {round(t.quota)} | {c(t.chat)} | {c(t.aux)} | {c(t.audio)} | {c(t.chat+t.aux+t.audio)} |")
row('Texte, 1er tour de séance (sans outil, sans raisonnement)', m.session(1, voice_share=0, tool_t1=0, reasoning=0)[0])
row('Texte, 1er tour avec appel get_student_profile', m.session(1, voice_share=0, tool_t1=1, reasoning=0)[0])
row('Texte, 2e tour', m.session(2, voice_share=0, reasoning=0)[1])
row('Texte, 2e tour avec raisonnement high (R=1000)', m.session(2, voice_share=0, reasoning=1)[1])
row('Texte, 6e tour', m.session(6, voice_share=0, reasoning=0)[5])
row('Texte, 12e tour (résumé actif)', m.session(12, voice_share=0, reasoning=0)[11])
row('Photo, 1er tour (sans outil)', m.session(1, photo=True, voice_share=0, tool_t1=0, reasoning=0)[0])
row('Tour suivant une photo (2e tour)', m.session(2, photo=True, voice_share=0, reasoning=0)[1])
row('Voix, 2e tour (STT 15 s + TTS 150 tokens)', m.session(2, voice_share=1, reasoning=0)[1])
row('Texte lu à voix haute (TTS 250 tokens)', m.session(2, voice_share=0, reasoning=0, tts_all=True)[1])

m.P_TOOL_UPD = 0.1
print('### T2 profils')
for p, (pw, tpt) in m.PROFILES.items():
    for plan in (None, 'gratuit', 'complet'):
        mo = m.month(p, plan)
        print(f"| {p} | {plan or 'sans plafond'} | {pw} × {tpt} | {f(mo['turns'],0)} | {round(mo['quota']/1000)} k | {f(mo['chat'],3)} | {f(mo['aux'],3)} | {f(mo['audio'],3)} | **{f(mo['total'],3)}** |")

print('### T3 plafonds')
for plan in m.PLANS:
    for label, kw in (('usage type (mélange par défaut)', {}), ('photo à chaque séance', {'photo': True}), ('photo + chaque réponse lue (TTS)', {'photo': True, 'tts_all': True})):
        cst, n, d, w = m.cap_day(plan, **kw)
        print(f"| {plan} | {label} | {n} | {round(d)} | {w} | {f(cst,4)} | **{f(cst*30,2)}** |")
