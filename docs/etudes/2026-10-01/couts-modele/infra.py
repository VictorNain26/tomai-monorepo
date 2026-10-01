FX_USD = 1 / 1.1355  # S : BCE 2026-09-30, 1 € = 1,1355 $
SEC_MONTH = 730 * 3600

def scw_container(vcpu, gb, n=1):
    cpu = max(0, vcpu * SEC_MONTH * n - 200_000) * 0.00001
    mem = max(0, gb * SEC_MONTH * n - 400_000) * 0.000002
    return cpu + mem

TIERS = [0, 100, 1000, 10000]
EMAILS_PER_STUDENT = 6  # H
def tem(n):
    return max(0, n * EMAILS_PER_STUDENT - 300) * 0.25 / 1000

options = {
 'Koyeb (Francfort, existant)': {
   0: 10.71 + 29.76 + 2 * 0.5, 100: 10.71 + 29.76 + 2 * 0.5,
   1000: 21.43 + 59.52 + 10 * 0.5, 10000: 2 * 21.43 + 59.52 + 20 * 0.5},
 'Scaleway (Paris)': {
   0: 6.55 / FX_USD * 0 + 6.55 + 730 * 0.0156 + 10 * 0.0993, 100: 6.55 + 730 * 0.0156 + 10 * 0.0993,
   1000: 14.74 + 730 * 0.0233 + 10 * 0.0993, 10000: 2 * 20.10 + 730 * 0.0382 + 20 * 0.0993 + 20 * 0.03},
 'Clever Cloud (Paris)': {
   0: 0.008333 * 720 + 5.25, 100: 0.008333 * 720 + 5.25,
   1000: 0.022222 * 720 + 19.5, 10000: 2 * 0.044444 * 720 + 44.0},
}
usd = {'Koyeb (Francfort, existant)'}
common = lambda n: {
  'Vercel Pro (1 siège)': 20 * FX_USD,
  'Sentry': 0 if n < 10000 else 26 * FX_USD,
  'E-mail (Scaleway TEM)': tem(n),
  'Domaine .fr (OVH, renouvellement 7,79 €/an)': 7.79 / 12,
  'Stockage objet Scaleway (photos)': 0.01606 * {0: 1, 100: 2, 1000: 20, 10000: 200}[n],
}
if __name__ == '__main__':
    print('scw container always-on 0.5vCPU/1GB', round(scw_container(0.5, 1), 2))
    for name, d in options.items():
        print(name, {n: round(v * (FX_USD if name in usd else 1), 2) for n, v in d.items()})
    for n in TIERS:
        c = common(n); print(n, {k: round(v, 2) for k, v in c.items()}, round(sum(c.values()), 2))
