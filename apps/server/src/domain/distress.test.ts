import { describe, it, expect } from 'bun:test';
import { detectDistress, DISTRESS_REPLY, matchesDistressRules } from './distress';

describe('matchesDistressRules', () => {
  it('sees distress in first-person wishes to die or disappear, and in self-harm, as a student types them', () => {
    for (const text of [
      "de toute façon ça sert à rien, j'ai envie de disparaître",
      "j'ai envie de disparaitre",
      'J’ai envie de mourir',
      'je me fais du mal quand je rate',
      "j'ai plus envie de vivre",
      "j'ai pas envie de vivre comme ça",
      "personne m'aimerait si je disparaissais",
      'je veux en finir',
      'je pense à me suicider',
      "je vais me tuer si j'ai encore une mauvaise note",
      'je voudrais ne plus exister',
      'si je mourais personne le remarquerait',
      "la vie n'a plus de sens",
      'je me scarifie',
      "j'ai envie d'en finir",
      "j'ai envie de me tuer",
      "j'ai trop envie de mourir",
      'je veux plus vivre',
      'jveux mourir',
      'je me suis coupée exprès',
      "ma vie n'a aucun sens",
      'je ne veux plus vivre',
      'je veux pas vivre',
      "j'ai envie de me pendre",
      'je me suicide',
      'je pense au suicide',
      'je veux me jeter par la fenêtre',
      "j'ai vraiment trop envie de mourir",
    ]) {
      expect({ text, distress: matchesDistressRules(text) }).toEqual({ text, distress: true });
    }
  });

  it('leaves alone discouragement, figures of speech, accidents and school texts about death', () => {
    for (const text of [
      "j'y arriverai jamais, je suis trop nul",
      'ce devoir me tue',
      'je suis mort de rire',
      'je vais mourir de honte si je rate',
      "j'ai envie de mourir de rire",
      "la grenouille meurt à la fin de l'histoire",
      'explique-moi le suicide de Roméo et Juliette',
      'le chevalier veut tuer le dragon',
      'je me coupe les cheveux',
      "je me frappe la tête tellement c'est dur",
      'je pense que je vais me blesser au sport',
      'si je triche personne le remarquerait',
      "quand je n'étais plus là mon chat a fugué",
      'Pourquoi Werther a envie de mourir ?',
      "Le personnage n'a plus envie de vivre",
      'je me suis coupé en cuisine',
      'je vais me jeter à l’eau et lever la main',
      'pour Meursault, la vie n’a pas de sens',
      "j'ai pas envie de mourir",
      "j'ai jamais envie de disparaître",
      'je veux crever de rire',
      "j'ai envie de crever de faim tellement j'ai faim",
    ]) {
      expect({ text, distress: matchesDistressRules(text) }).toEqual({ text, distress: false });
    }
  });
});

describe('detectDistress', () => {
  it('says who saw the distress: moderation, the rules, both, or none', () => {
    expect(detectDistress("j'ai envie de disparaître", true)).toBe('both');
    expect(detectDistress('Je pars loin, adieu tout le monde', true)).toBe('moderation');
    expect(detectDistress('je me fais du mal quand je rate', false)).toBe('rules');
    expect(detectDistress('ce devoir me tue', false)).toBeNull();
  });
});

describe('DISTRESS_REPLY', () => {
  it('gives the 3114, the emergency numbers and a trusted adult, says it is an AI, and ends the conversation', () => {
    for (const part of ['3114', '15', '112', 'adulte de confiance', 'intelligence artificielle', "J'arrête notre conversation ici"]) {
      expect(DISTRESS_REPLY).toContain(part);
    }
    expect(DISTRESS_REPLY).not.toContain('?');
  });
});
