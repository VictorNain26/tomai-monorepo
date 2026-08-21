/**
 * OTEL_EXPORTER_OTLP_HEADERS parsing.
 *
 * Le format OTLP standard est `key1=value1,key2=value2`. Le piège : une valeur
 * peut légitimement contenir des `=` — c'est le cas de TOUT header
 * `Authorization: Basic <base64>`, le base64 étant padé avec `=` ou `==`.
 * Découper sur tous les `=` tronque la valeur et produit un 401 silencieux.
 */

import { describe, expect, it } from 'bun:test';
import { buildHeaders } from '../lib/otel/otel.js';

describe('buildHeaders', () => {
  it('renvoie undefined quand la variable est absente ou vide', () => {
    expect(buildHeaders(undefined)).toBeUndefined();
    expect(buildHeaders('')).toBeUndefined();
  });

  it('parse une paire simple', () => {
    expect(buildHeaders('x-api-key=abc123')).toEqual({ 'x-api-key': 'abc123' });
  });

  it('parse plusieurs paires séparées par une virgule', () => {
    expect(buildHeaders('a=1,b=2')).toEqual({ a: '1', b: '2' });
  });

  it('préserve le padding base64 d\'un Authorization Basic', () => {
    // Cas réel : Langfuse attend Basic base64(publicKey:secretKey), et ce
    // base64 se termine presque toujours par un ou deux `=`.
    const credentials = Buffer.from('pk-lf-public:sk-lf-secret').toString('base64');
    expect(credentials).toContain('='); // le padding existe bien

    const headers = buildHeaders(`Authorization=Basic ${credentials}`);

    expect(headers).toEqual({ Authorization: `Basic ${credentials}` });
  });

  it('préserve toute valeur contenant des `=` ailleurs qu\'en séparateur', () => {
    expect(buildHeaders('token=a=b=c')).toEqual({ token: 'a=b=c' });
  });

  it('ignore une entrée sans `=` plutôt que de produire un header vide', () => {
    expect(buildHeaders('bancal,a=1')).toEqual({ a: '1' });
  });

  it('ignore une entrée dont la clé est vide', () => {
    expect(buildHeaders('=orphelin,a=1')).toEqual({ a: '1' });
  });
});
