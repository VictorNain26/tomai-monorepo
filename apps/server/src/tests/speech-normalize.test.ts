/**
 * Tests unitaires — normalizeForSpeech (lib/text/speech-normalize.ts)
 * Valide la suppression du markdown et la conversion KaTeX en texte parlé.
 * Invariant fort : aucun `$` ni `\` résiduel après normalisation.
 */

import { describe, it, expect } from 'bun:test';
import { normalizeForSpeech } from '../lib/text/speech-normalize.js';

describe('normalizeForSpeech — markdown', () => {
  it('supprime le gras avec **', () => {
    expect(normalizeForSpeech('Le résultat est **important**.')).toBe('Le résultat est important.');
  });

  it('supprime le gras avec __', () => {
    expect(normalizeForSpeech('Le résultat est __important__.')).toBe('Le résultat est important.');
  });

  it("supprime l'italique avec *", () => {
    expect(normalizeForSpeech('Un mot *en italique* ici.')).toBe('Un mot en italique ici.');
  });

  it("supprime l'italique avec _", () => {
    expect(normalizeForSpeech('Un mot _en italique_ ici.')).toBe('Un mot en italique ici.');
  });

  it('supprime le code inline', () => {
    expect(normalizeForSpeech('La fonction `parseInt()` convertit.')).toBe(
      'La fonction parseInt() convertit.',
    );
  });

  it('supprime les blocs de code fencés', () => {
    const input = 'Voici un exemple :\n```\nconst x = 1;\n```\nFin.';
    expect(normalizeForSpeech(input)).toBe('Voici un exemple :\n\nFin.');
  });

  it('supprime les blocs de code fencés avec langage', () => {
    const input = '```typescript\nconst x = 1;\n```';
    expect(normalizeForSpeech(input)).toBe('');
  });

  it('supprime les titres H1 à H6', () => {
    expect(normalizeForSpeech('# Introduction')).toBe('Introduction');
    expect(normalizeForSpeech('## Section')).toBe('Section');
    expect(normalizeForSpeech('### Sous-section')).toBe('Sous-section');
  });

  it('supprime les marqueurs de liste avec tiret', () => {
    expect(normalizeForSpeech('- Premier point\n- Deuxième point')).toBe(
      'Premier point\nDeuxième point',
    );
  });

  it('supprime les marqueurs de liste avec astérisque', () => {
    expect(normalizeForSpeech('* Premier\n* Deuxième')).toBe('Premier\nDeuxième');
  });

  it('supprime les marqueurs de liste numérotée', () => {
    expect(normalizeForSpeech('1. Premier\n2. Deuxième\n10. Dixième')).toBe(
      'Premier\nDeuxième\nDixième',
    );
  });

  it('transforme les liens markdown en texte seul', () => {
    expect(normalizeForSpeech('Voir [la documentation](https://example.com) ici.')).toBe(
      'Voir la documentation ici.',
    );
  });

  it('supprime les citations blockquote', () => {
    expect(normalizeForSpeech('> Ceci est une citation.')).toBe('Ceci est une citation.');
  });

  it('gère un texte mixte réaliste (réponse de Tom)', () => {
    const input = `## Résumé

La **loi de Pythagore** dit que dans un triangle rectangle :

- Le carré de l'hypoténuse est **égal** à la somme des carrés des autres côtés.
- On écrit : _a² + b² = c²_

Voir [plus d'infos](https://fr.wikipedia.org/wiki/Pythagore).`;

    const result = normalizeForSpeech(input);
    expect(result).not.toContain('**');
    expect(result).not.toContain('_');
    expect(result).not.toContain('#');
    expect(result).not.toContain('[');
    expect(result).not.toContain('](');
    expect(result).toContain('loi de Pythagore');
    expect(result).toContain('Résumé');
  });
});

describe('normalizeForSpeech — KaTeX courant', () => {
  it('convertit \\frac en « a sur b »', () => {
    expect(normalizeForSpeech('La fraction $\\frac{1}{2}$.')).toBe('La fraction 1 sur 2.');
  });

  it('convertit x^2 en « x au carré »', () => {
    expect(normalizeForSpeech('Le carré $x^2$.')).toBe('Le carré x au carré.');
  });

  it('convertit x^3 en « x au cube »', () => {
    expect(normalizeForSpeech('Le cube $x^3$.')).toBe('Le cube x au cube.');
  });

  it('convertit x^n en « x puissance n »', () => {
    expect(normalizeForSpeech('La puissance $x^n$.')).toBe('La puissance x puissance n.');
  });

  it('convertit \\sqrt en « racine de x »', () => {
    expect(normalizeForSpeech('La racine $\\sqrt{x}$.')).toBe('La racine racine de x.');
  });

  it('convertit \\times en « fois »', () => {
    expect(normalizeForSpeech('Le produit $a \\times b$.')).toBe('Le produit a fois b.');
  });

  it('convertit \\div en « divisé par »', () => {
    expect(normalizeForSpeech('La division $a \\div b$.')).toBe('La division a divisé par b.');
  });

  it('convertit \\pi en « pi »', () => {
    expect(normalizeForSpeech('La constante $\\pi$.')).toBe('La constante pi.');
  });

  it('convertit \\le et \\leq en « inférieur ou égal à »', () => {
    expect(normalizeForSpeech('$x \\le 5$')).toBe('x inférieur ou égal à 5');
    expect(normalizeForSpeech('$x \\leq 5$')).toBe('x inférieur ou égal à 5');
  });

  it('convertit \\ge et \\geq en « supérieur ou égal à »', () => {
    expect(normalizeForSpeech('$x \\ge 5$')).toBe('x supérieur ou égal à 5');
    expect(normalizeForSpeech('$x \\geq 5$')).toBe('x supérieur ou égal à 5');
  });

  it('supprime les délimiteurs $$ pour les formules en bloc', () => {
    const input = 'La formule : $$\\frac{a}{b} = c$$';
    const result = normalizeForSpeech(input);
    expect(result).not.toContain('$');
    expect(result).not.toContain('\\');
    expect(result).toContain('a sur b');
  });

  it('gère une formule complexe mélangée', () => {
    const input = 'On a $\\frac{x^2 + 1}{2} \\times \\pi$.';
    const result = normalizeForSpeech(input);
    expect(result).not.toContain('$');
    expect(result).not.toContain('\\');
    expect(result).toContain('au carré');
    expect(result).toContain('pi');
  });
});

describe('normalizeForSpeech — invariant : zéro $ ni \\ résiduel', () => {
  const samples = [
    '**Gras** et $\\frac{1}{2}$ avec `code`.',
    '# Titre\n- liste\n$\\sqrt{x^2 + \\pi}$',
    '[lien](url) > citation $x^3 \\times \\pi$',
    'LaTeX inconnu $\\sum_{i=0}^{n} x_i$ reste propre.',
    'Commande inconnue $\\unknownCmd{arg}$ doit être stripée.',
  ];

  for (const sample of samples) {
    it(`pas de $ ni \\ dans : "${sample.slice(0, 40)}..."`, () => {
      const result = normalizeForSpeech(sample);
      expect(result).not.toContain('$');
      expect(result).not.toContain('\\');
    });
  }
});
