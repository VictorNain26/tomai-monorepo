import { describe, expect, it } from 'bun:test';
import { getAppHelpContent } from '../config/app-guide/app-guide-data';

const TOPICS = [
  'overview',
  'navigation',
  'chat',
  'flashcards',
  'pronote',
  'files',
  'subscription',
  'profile',
] as const;
const ROLES = ['student', 'parent'] as const;
const MOBILE_ONLY = [
  /app store/i,
  /play store/i,
  /google play/i,
  /revenuecat/i,
  /onglet/i,
  /en bas de l'ecran/i,
  /appareil photo/i,
  /galerie/i,
  /badge/i,
];

describe('app guide content served by get_app_help', () => {
  for (const topic of TOPICS) {
    for (const role of ROLES) {
      it(`${topic}/${role} describes no mobile-only UI or store payment`, () => {
        const content = getAppHelpContent(topic, role);
        expect(content).not.toBeNull();
        for (const pattern of MOBILE_ONLY) {
          expect(content).not.toMatch(pattern);
        }
      });
    }
  }

  it.each([...ROLES])('subscription/%s says the online subscription is not available yet', (role) => {
    expect(getAppHelpContent('subscription', role)).toContain("pas encore disponible en ligne");
  });
});
