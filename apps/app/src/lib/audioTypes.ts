/**
 * Types pour AudioManager
 * Architecture à trois contextes séparés (pattern React officiel)
 *
 * @see https://react.dev/learn/scaling-up-with-reducer-and-context
 */

export interface AudioState {
  isGlobalEnabled: boolean;
  currentlySpeaking: boolean;
  activeMessageId: string | null;
}
