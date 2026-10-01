import couts_model as m, infra
PRICES = [4.99, 7.99, 9.99, 14.99]
STRIPE_PCT, STRIPE_FIX, BILLING = 0.015, 0.25, 0.007
def net(p):
    return p / 1.2 - (p * (STRIPE_PCT + BILLING) + STRIPE_FIX)
ai_payer = {k: m.month(k, 'complet')['total'] for k in m.PROFILES}
ai_payer['plafond'] = m.cap_day('complet')[0] * 30
ai_payer['plafond + TTS'] = m.cap_day('complet', photo=True, tts_all=True)[0] * 30
ai_free = m.month('normal', 'gratuit')['total']
ai_free_cap = m.cap_day('gratuit')[0] * 30
def fixed(n):
    host = max(v[n if n in v else 10000] * (infra.FX_USD if 'Koyeb' in k else 1) for k, v in infra.options.items()) if n in (0,100,1000,10000) else None
    return host + sum(infra.common(n).values())
FIX = {n: fixed(n) for n in infra.TIERS}
if __name__ == '__main__':
    print('fixed', {n: round(v, 2) for n, v in FIX.items()})
    print('ai_payer', {k: round(v, 3) for k, v in ai_payer.items()}, 'free', round(ai_free, 3), round(ai_free_cap, 3))
    for p in PRICES:
        n_ = net(p)
        print(f"| {p:.2f} € | {p/1.2:.2f} | {p*(STRIPE_PCT+BILLING)+STRIPE_FIX:.2f} | **{n_:.2f}** | " + ' | '.join(f"{n_-v:.2f}" for v in ai_payer.values()) + ' |')

CONV = {'2,1 %': 0.021, '4,5 %': 0.045, '9 %': 0.09}
def fix_at(n):
    return FIX[100] if n <= 100 else FIX[1000] if n <= 1000 else FIX[10000]
def breakeven(p, c, free_cost, payer_cost):
    for n in range(1, 200001):
        payers = c * n
        if payers * (net(p) - payer_cost) >= fix_at(n) + (1 - c) * n * free_cost:
            return n, payers
    return None, None
def table():
    for free_label, fc in (('gratuit normal', ai_free), ('gratuit au plafond', ai_free_cap)):
        print('##', free_label)
        for p in PRICES:
            cells = []
            for cl, cv in CONV.items():
                n, pay = breakeven(p, cv, fc, ai_payer['normal'])
                cells.append(f"{pay:.0f} abonnés / {n} élèves" if n else 'jamais')
            print(f"| {p:.2f} € | " + ' | '.join(cells) + ' |')
    # bénéfice à 1000 et 10000 élèves
    print('## résultat mensuel')
    for N in (1000, 10000):
        for p in PRICES:
            cells = []
            for cl, cv in CONV.items():
                r = cv*N*(net(p)-ai_payer['normal']) - fix_at(N) - (1-cv)*N*ai_free
                cells.append(f"{r:.0f}")
            print(N, f"{p:.2f}", cells)
if __name__ == '__main__':
    table()
    print('paddle 4.99', 4.99/1.2 - (0.05*4.99 + 0.50/1.1355))
