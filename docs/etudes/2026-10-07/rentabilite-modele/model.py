"""Modèle de rentabilité de Tom (2026-10-07). Sans dépendance : `python3 model.py` imprime les
tableaux de `../rentabilite.md`. Chaque entrée porte son statut : M mesuré, S sourcé (page
officielle lue le 2026-10-07), H hypothèse, C calcul ; les sources sont dans l'étude."""

# ================================================================ Coût d'un événement (centimes HT)
# Passage de fin du 2026-10-06 (359 tours d'élève), cost_tracking au taux que Mistral applique au
# compte : coût total d'un type d'appel divisé par son nombre d'appels (M).
SHEET_DRAW = 34.9 / 257      # M : un tirage de fiche d'exercice, raisonnement high
DRAWS = 3                    # M : trois tirages votés par exercice (code du tuteur)
CHAT = 9.3 / 359             # M : un tour de rédaction, cache compris
ANALYSIS_NONE = 1.9 / 363    # M : l'analyse du tour, sans raisonnement
DIAGNOSIS = 0.3 / 35         # M : le diagnostic d'une proposition
TITLE = 0.4 / 112            # M : le titre d'une séance

USD_EUR = 0.85               # S : taux appliqué par Mistral au compte (page Coûts, 2026-10-06)
EU = 1.1                     # S : majoration de l'endpoint UE
OUT_C = 0.60 / 1e6 * EU * USD_EUR * 100   # S : un token de sortie de Small 4, en centimes
IN_C = 0.15 / 1e6 * EU * USD_EUR * 100    # S : un token d'entrée (et d'image)

REASONING = 1000             # H : tokens de raisonnement de l'analyse passée en high par #415
P_REGEN = 0.10               # H : tours que le contrôle fait régénérer une fois
P_ATTEMPT = 0.4              # H : tours où l'élève propose une réponse (diagnostic)
PHOTO = 2352 * IN_C + 800 * OUT_C        # M : image de 2 352 tokens ; H : 800 tokens de lecture
STT = 0.003 * 0.25 * EU * USD_EUR * 100  # S : 0,003 $ la minute ; H : 15 s par tour dicté
TTS = 150 * 3.4 * 16 / 1e6 * EU * USD_EUR * 100  # S : 16 $ le M de caractères ; H : 150 tokens lus ; M : 3,4 car./token
SUMMARY = (3000 * IN_C + 400 * OUT_C) / 10      # H : un résumé incrémental tous les 10 tours
PARENT_WEEK = 5000 * IN_C + 400 * OUT_C         # H : le résumé hebdomadaire au parent

P_PHOTO = 0.25               # H : exercices apportés en photo
P_VOICE = 0.10               # H : tours dictés
P_TTS = 0.10                 # H : réponses lues à voix haute

PROFILES = {                 # H : séances par semaine, tours par séance, exercices par séance
    'léger': (2, 3, 1.0),
    'normal': (4, 6, 1.5),
    'intensif': (6, 12, 3.0),
}
# H : 36 semaines de cours, 8 semaines de petites vacances à 30 % de l'usage, été nul.
WEEKS_PER_MONTH = (36 + 8 * 0.3) / 12
CHILDREN = 1.16              # C : collégiens par foyer qui en a un (recensement 2021)


def analysis(reasoning=REASONING):
    return ANALYSIS_NONE + reasoning * OUT_C


def turn_cost(p_tts=P_TTS, reasoning=REASONING, p_voice=P_VOICE):
    return CHAT * (1 + P_REGEN) + analysis(reasoning) + P_ATTEMPT * DIAGNOSIS + p_voice * STT + p_tts * TTS + SUMMARY


def session_cost(turns, exercises, p_tts=P_TTS, p_photo=P_PHOTO, reasoning=REASONING):
    return exercises * (DRAWS * SHEET_DRAW + p_photo * PHOTO) + turns * turn_cost(p_tts, reasoning) + TITLE


def student_month(profile, p_tts=P_TTS, reasoning=REASONING):
    """€ HT par élève et par mois, en moyenne sur l'année."""
    sessions, turns, exercises = PROFILES[profile]
    return WEEKS_PER_MONTH * (sessions * session_cost(turns, exercises, p_tts, reasoning=reasoning) + PARENT_WEEK) / 100


# ================================================================ Revenu et fiscalité
PRICE = 7.99                 # TTC, par foyer et par mois
VAT = 0.20                   # S : taux normal (un taux réduit est à faire qualifier, voir l'étude)
REDUCED_VAT = 0.055          # S : le taux qu'applique Kartable, à faire qualifier pour Tom
STRIPE = (0.015 + 0.007, 0.25)   # S : carte EEE standard 1,5 % + 0,25 €, Stripe Billing 0,7 %
COTIS = {'BIC': 0.212, 'BNC': 0.256}   # S : micro-entreprise, 2026
VL = {'BIC': 0.017, 'BNC': 0.022}      # S : versement libératoire
FRANCHISE = 37_500           # S : seuil de base de la franchise de TVA (services), 2026
MICRO_CAP = 83_600           # S : plafond de chiffre d'affaires micro (services)
EXISTING_CA = 0              # H : chiffre d'affaires annuel de l'activité micro existante, à donner par Victor
IS_LOW, IS_LOW_CAP, IS_HIGH = 0.15, 42_500, 0.25   # S : impôt sur les sociétés
PFU = 0.314                  # S : flat tax sur les dividendes, 2026
SASU_ACCOUNTANT = 1000 / 12  # S : expert-comptable en ligne, 470 à 1 250 € HT par an


def revenue_ht(price, vat_due):
    return price / (1 + VAT) if vat_due else price


def fees(price):
    return price * STRIPE[0] + STRIPE[1]


def net_per_household(price=PRICE, vat_due=False, cat='BIC', ai_cost=0.0):
    """Reste au fondateur par foyer payant et par mois, en micro avec versement libératoire, avant
    les coûts fixes. En franchise, la TVA des fournisseurs ne se récupère pas : l'IA compte TTC."""
    rev = revenue_ht(price, vat_due)
    return rev - fees(price) - rev * (COTIS[cat] + VL[cat]) - ai_cost * (1 if vat_due else 1 + VAT)


# ================================================================ Coûts fixes mensuels (€ HT)
UNITS_TURN = 4               # H : points Langfuse d'un tour (trace, rédaction, analyse, part du diagnostic et du résumé)
UNITS_EXERCISE = 4           # H : une trace et trois tirages de fiche
EMAILS = 6                   # H : e-mails par élève et par mois (H19 de ../2026-10-01/couts.md)


def langfuse_units(profile):
    sessions, turns, exercises = PROFILES[profile]
    return WEEKS_PER_MONTH * sessions * (turns * UNITS_TURN + exercises * UNITS_EXERCISE)


def langfuse_month(units):
    """S : Hobby gratuit jusqu'à 50 000 points, Core 29 $ avec 100 000, puis 8 $ les 100 000 jusqu'à
    1 M et 7 $ jusqu'à 10 M (langfuse.com/pricing, 2026-10-07)."""
    if units <= 50_000:
        return 0.0
    over = max(0.0, units - 100_000)
    usd = 29 + min(over, 900_000) / 1e5 * 8 + max(0.0, over - 900_000) / 1e5 * 7
    return usd / 1.1269


def fixed_month(students, units):
    """Par élèves actifs du mois, gratuits compris (paliers de ../2026-10-01/couts.md) : hébergement
    au plus cher de Scaleway et Clever Cloud (S), au-delà de 10 000 élèves un palier de plus par
    tranche (H) ; outils (S) ; assurance RC pro (H). Mistral n'a pas de frais fixes : le ZDR ne
    demande que le paiement à l'usage."""
    if students <= 100:
        hosting, sentry, storage = 22.45, 0, 0.03
    elif students <= 1000:
        hosting, sentry, storage = 57.0, 0, 0.32
    else:
        tranches = -(-students // 10_000)
        hosting, sentry, storage = 152.0 * tranches, 23.07, 3.21 * tranches
    email = max(0.0, students * EMAILS - 300) * 0.25 / 1000
    vercel, uptime, domain, insurance = 17.75, 9.0, 0.65, 25.0
    return hosting + sentry + storage + email + langfuse_month(units) + vercel + uptime + domain + insurance


def platform(paying, share, free_profile='léger', paid_profile='normal'):
    """Élèves actifs et points Langfuse du mois pour `paying` foyers payants et une part payante."""
    free_n = paying * (1 - share) / share
    students = (paying + free_n) * CHILDREN
    units = (paying * langfuse_units(paid_profile) + free_n * langfuse_units(free_profile)) * CHILDREN
    return students, units


ONE_OFF = {'avocat : CGV, confidentialité, AIPD (H)': 2000, 'marque INPI, une classe (H)': 190}

# ================================================================ Rétention et part payante
RETENTION = {                # S + C : survie après le 1er, 2e, 3e mois, puis départ mensuel
    'basse': (0.50, 0.33, 0.25, 0.16),
    'médiane': (0.55, 0.39, 0.30, 0.14),
    'haute': (0.61, 0.46, 0.37, 0.10),
}
INSTALL_CONVERSION = {'basse': 0.020, 'médiane': 0.031, 'haute': 0.045}  # S : RevenueCat, inscrits → payants
PAID_SHARE = {'basse': 0.03, 'médiane': 0.06, 'haute': 0.09}  # H : part des foyers actifs du mois qui paient
SUMMER_CHURN = 2.0           # H : départs doublés en juillet et en août
SIGNUP_SEASON = [2.0, 1.5, 1, 1, 1, 1, 1, 1, 1, 1.2, 0.2, 0.2]   # H : de septembre à août


def survival(scenario, months):
    s1, s2, s3, churn = RETENTION[scenario]
    out = [1.0, s1, s2, s3]
    while len(out) < months:
        out.append(out[-1] * (1 - churn))
    return out[:months]


def lifetime_months(scenario, seasonal=False):
    """Mensualités payées en moyenne. Saisonnier : cohortes pondérées par les inscriptions du mois,
    départs doublés en juillet-août (mois 10 et 11 depuis septembre)."""
    if not seasonal:
        return sum(survival(scenario, 240))
    s1, s2, s3, churn = RETENTION[scenario]
    total = weight = 0.0
    for start, w in enumerate(SIGNUP_SEASON):
        alive, paid = 1.0, 0.0
        for k in range(240):
            paid += alive
            month = (start + k + 1) % 12
            base = [s1, s2 / s1, s3 / s2][k] if k < 3 else 1 - churn
            leave = 1 - base
            if month in (10, 11):
                leave = min(1.0, leave * SUMMER_CHURN)
            alive *= 1 - leave
        total += w * paid
        weight += w
    return total / weight


# ================================================================ Tableaux
def table(head, rows):
    out = ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)]
    out += ['| ' + ' | '.join(str(x) for x in r) + ' |' for r in rows]
    return '\n'.join(out)


def c(x):
    return f'{x:.3f}'.replace('.', ',')


def e(x, d=2):
    return f'{x:,.{d}f}'.replace(',', ' ').replace('.', ',')


QUOTA_FREE, QUOTA_PAID = 2.0, 10.0   # proposés, en centimes par élève et par jour
ANNUAL = (59, 69, 79)        # H : prix d'une année scolaire payée d'avance, TTC


def free_household(profile, quota=QUOTA_FREE):
    """€ TTC par foyer gratuit actif et par mois : chaque soirée du profil plafonnée par le quota du
    jour (une séance par jour), le résumé au parent hors quota."""
    sessions, turns, exercises = PROFILES[profile]
    student = WEEKS_PER_MONTH * (sessions * min(session_cost(turns, exercises), quota) + PARENT_WEEK) / 100
    return student * CHILDREN * (1 + VAT)


def vat_due(paying):
    return paying * PRICE * 12 + EXISTING_CA > FRANCHISE


def founder_month(paying, share, free_profile='léger'):
    """Reste au fondateur par mois, en micro BIC avec versement libératoire puis en SASU aux
    dividendes, gratuits du mois et coûts fixes compris. En franchise, la TVA des fournisseurs
    (IA, hébergement, outils) ne se récupère pas ; les frais de paiement en sont exonérés."""
    free_n = paying * (1 - share) / share
    students, units = platform(paying, share, free_profile)
    due = vat_due(paying)
    rev = revenue_ht(PRICE, due) * paying
    supplies = student_month('normal') * CHILDREN * paying + free_household(free_profile) / (1 + VAT) * free_n
    supplies += fixed_month(students, units)
    costs = supplies * (1 if due else 1 + VAT) + fees(PRICE) * paying
    micro = rev * (1 - COTIS['BIC'] - VL['BIC']) - costs
    year = (rev - costs - SASU_ACCOUNTANT) * 12
    tax = min(year, IS_LOW_CAP) * IS_LOW + max(0.0, year - IS_LOW_CAP) * IS_HIGH if year > 0 else 0
    sasu = (year - tax) * (1 - PFU) / 12 if year > 0 else year / 12
    return micro, sasu


def main():
    print("## Coût d'un événement (centimes HT)\n")
    print(table(['Événement', 'Centimes'], [
        ['Exercice : trois tirages de fiche', c(DRAWS * SHEET_DRAW)],
        ["Photo d'un exercice (lecture)", c(PHOTO)],
        ['Tour : rédaction, régénération comprise', c(CHAT * (1 + P_REGEN))],
        [f'Tour : analyse en raisonnement ({REASONING} tokens)', c(analysis())],
        ['Tour : diagnostic (une fois sur 2,5)', c(P_ATTEMPT * DIAGNOSIS)],
        ['Tour dicté : transcription de 15 s', c(STT)],
        ['Réponse lue à voix haute', c(TTS)],
        ['Tour : résumé incrémental, amorti', c(SUMMARY)],
        ['Résumé hebdomadaire au parent', c(PARENT_WEEK)],
        ['Tour type (10 % dictés, 10 % lus)', c(turn_cost())],
        ['Tour type sans voix', c(turn_cost(0, p_voice=0))],
    ]))

    print("\n## Coût d'une soirée (une séance), centimes HT\n")
    rows = []
    for name, (_, turns, ex) in PROFILES.items():
        rows.append([name, f'{turns} tours, {e(ex, 1)} exercice(s)', c(session_cost(turns, ex, 0, 0)), c(session_cost(turns, ex)),
                     c(session_cost(turns, ex, 1.0)), c(session_cost(turns, ex, 1.0, 1.0))])
    print(table(['Profil', 'Séance', 'Texte seul', 'Type (photo 25 %, voix 10 %)', 'Chaque réponse lue', 'Lue, et photo à chaque exercice'], rows))

    print("\n## Coût par élève et par mois (€ HT, moyenne sur l'année)\n")
    print(table(['Profil', 'Type', 'Sans voix', 'Chaque réponse lue'],
                [[n, e(student_month(n), 3), e(student_month(n, 0), 3), e(student_month(n, 1.0), 3)] for n in PROFILES]))

    print('\n## Quota quotidien par élève : ce qu\'il couvre, ce qu\'il coûte au plafond\n')
    normal, intensive = session_cost(6, 1.5), session_cost(12, 3)
    rows = []
    for budget in (0.75, 1.0, 1.5, 2.0, 5.0, 8.0, 12.0):
        rows.append([e(budget, 2), e(budget / normal, 1), e(budget / intensive, 1), e(budget / turn_cost(0, p_voice=0), 0),
                     e(budget * 30 / 100 * CHILDREN * (1 + VAT))])
    print(table(['Budget (c par jour)', 'Soirées normales', 'Soirées intensives', 'Tours de texte sans exercice',
                 'Foyer au plafond 30 jours (€ TTC)'], rows))

    print('\n## Net par foyer payant et par mois (micro, versement libératoire, Stripe), avant coûts fixes\n')
    ai_paid = student_month('normal') * CHILDREN
    rows = []
    for price in (5.99, 7.99, 9.99, 12.99):
        for due in (False, True):
            rows.append([e(price), 'due' if due else 'franchise', e(net_per_household(price, due)),
                         e(net_per_household(price, due, ai_cost=ai_paid)),
                         e(net_per_household(price, due, ai_cost=QUOTA_PAID * 30 / 100 * CHILDREN)),
                         e(net_per_household(price, due, 'BNC', ai_cost=ai_paid))])
    print(table(['Prix TTC', 'TVA', 'Avant IA (BIC)', 'Usage normal (BIC)', f'Au plafond de {e(QUOTA_PAID, 0)} c chaque jour (BIC)', 'Usage normal (BNC)'], rows))

    print("\n## Durée de vie d'un foyer payant et valeur nette (7,99 €, franchise, BIC, usage normal)\n")
    net = net_per_household(ai_cost=ai_paid)
    rows = []
    for s in RETENTION:
        plain, seasonal = lifetime_months(s), lifetime_months(s, True)
        rows.append([s, e(plain, 1), e(seasonal, 1), e(net * seasonal), *[e(net * seasonal * INSTALL_CONVERSION[k]) for k in INSTALL_CONVERSION]])
    print(table(['Rétention', 'Mois payés', 'Avec un été à départs doublés', 'Valeur nette (€)',
                 'Par inscrit, conversion 2,0 %', '3,1 %', '4,5 %'], rows))

    print('\n## Le gratuit face aux payants : marge par payant, gratuits du mois compris (€)\n')
    rows = []
    for profile in PROFILES:
        for quota in (1.0, 2.0):
            free = free_household(profile, quota)
            row = [f'{profile}, quota {e(quota, 0)} c', e(free, 3)]
            row += [e(net - (1 - share) / share * free) for share in PAID_SHARE.values()]
            rows.append(row)
    print(table(["Usage moyen d'un foyer gratuit", 'Coût par foyer gratuit (€ TTC)', 'Part payante 3 %', '6 %', '9 %'], rows))

    print(f"\n## Ce qu'il faut pour payer les frais, puis un revenu (foyer gratuit moyen léger, quota {e(QUOTA_FREE, 0)} c)\n")
    life = lifetime_months('médiane', True)
    rows = []
    for target in (0, 1500, 2500):
        for share in PAID_SHARE.values():
            paying = next((n for n in range(1, 50_001) if founder_month(n, share)[0] >= target), None)
            if paying is None:
                rows.append([e(target, 0), f'{int(share * 100)} %', 'jamais', '—', '—', '—', '—'])
                continue
            students, _ = platform(paying, share)
            new_paid = paying / life
            rows.append([e(target, 0), f'{int(share * 100)} %', e(paying, 0), e(students, 0), e(new_paid, 0),
                         e(new_paid / INSTALL_CONVERSION['médiane'], 0), 'oui' if vat_due(paying) else 'non'])
    print(table(['Revenu visé (€ par mois)', 'Part payante', 'Foyers payants', 'Élèves actifs', 'Nouveaux payants par mois',
                 'Nouvelles inscriptions par mois (3,1 %)', 'TVA due'], rows))

    print('\n## Micro-entreprise ou SASU : ce qui reste au fondateur par mois (7,99 €, usage normal, gratuits légers)\n')
    rows = []
    for share in (PAID_SHARE['basse'], PAID_SHARE['médiane']):
        for paying in (100, 300, 500, 1000, 2000):
            micro, sasu = founder_month(paying, share)
            rev_ht = revenue_ht(PRICE, vat_due(paying)) * paying * 12
            rows.append([f'{int(share * 100)} %', paying, e(paying * PRICE * 12, 0), 'due' if vat_due(paying) else 'franchise',
                         e(micro, 0), e(sasu, 0), 'oui' if rev_ht + EXISTING_CA <= MICRO_CAP else 'non, plafond dépassé'])
    print(table(['Part payante', 'Foyers payants', 'CA annuel TTC (€)', 'TVA', 'Micro BIC, versement libératoire (€/mois)',
                 'SASU, dividendes au PFU (€/mois)', 'Micro possible'], rows))

    print("\n## L'année scolaire payée d'avance face au mensuel (franchise, BIC, usage normal)\n")
    life = lifetime_months('médiane', True)
    rows = [['mensuel 7,99 €', e(life, 1) + ' mois en moyenne', e(net * life)]]
    for price in ANNUAL:
        value = price - (price * STRIPE[0] + STRIPE[1]) - price * (COTIS['BIC'] + VL['BIC']) - ai_paid * 10 * (1 + VAT)
        rows.append([f'année scolaire {price} €', f'10 mois couverts, soit {e(price / 10)} € par mois', e(value)])
    print(table(['Formule', 'Durée', 'Valeur nette par foyer (€)'], rows))

    print('\n## Coûts fixes mensuels (€ HT), part payante de 6 %, gratuits légers\n')
    rows = []
    for paying in (30, 100, 300, 1000):
        students, units = platform(paying, PAID_SHARE['médiane'])
        rows.append([paying, e(students, 0), e(units, 0), e(langfuse_month(units)), e(langfuse_month(units * 0.1)),
                     e(fixed_month(students, units)), e(fixed_month(students, units * 0.1))])
    print(table(['Foyers payants', 'Élèves actifs', 'Points Langfuse', 'Langfuse', 'Langfuse, 10 % des traces',
                 'Coûts fixes', 'Coûts fixes, 10 % des traces'], rows))
    print()
    print(table(['Investissement initial', '€'], [[k, e(v, 0)] for k, v in ONE_OFF.items()]))

    print('\n## Sensibilité : net par foyer payant et par mois (7,99 €, franchise, BIC, usage normal)\n')
    variants = (
        ("Raisonnement de l'analyse : 2 000 tokens", student_month('normal', reasoning=2000)),
        ("Raisonnement de l'analyse : coupé", student_month('normal', reasoning=0)),
        ('Une réponse sur deux lue', student_month('normal', p_tts=0.5)),
        ('Chaque réponse lue', student_month('normal', p_tts=1.0)),
        ('Profil intensif', student_month('intensif')),
    )
    rows = [[label, e(net_per_household(ai_cost=cost * CHILDREN) - net)] for label, cost in variants]
    rows.append(['Carte premium au lieu de standard', e(-0.013 * PRICE)])
    rows.append(['Catégorie BNC au lieu de BIC', e(net_per_household(cat='BNC', ai_cost=ai_paid) - net)])
    rows.append(['TVA due au lieu de la franchise', e(net_per_household(vat_due=True, ai_cost=ai_paid) - net)])
    reduced = PRICE / (1 + REDUCED_VAT)
    rows.append([f'TVA due au taux réduit de {e(REDUCED_VAT * 100, 1)} %',
                 e(reduced - fees(PRICE) - reduced * (COTIS['BIC'] + VL['BIC']) - ai_paid - net)])
    print(table(['Variante', 'Écart (€ par foyer et par mois)'], rows))
    print(f'\nBase : {e(net)} € par foyer payant et par mois.')


if __name__ == '__main__':
    main()
