/**
 * Configuration éducative pour le AudioManager
 * Séparé pour respecter react-refresh/only-export-components
 */

export const EDUCATION_CONFIG = {
  primary: {
    rate: 0.8,        // Plus lent pour compréhension
    pitch: 1.0,       // Pitch naturel pour enfants
    volume: 0.9,      // Légèrement plus fort
    preferFemale: true // Voix féminine préférée pour primaire
  },
  college: {
    rate: 0.9,        // Tempo modéré
    pitch: 0.9,       // Légèrement plus grave
    volume: 0.8,      // Volume normal
    preferFemale: false // Voix mixte
  },
  lycee: {
    rate: 1.0,        // Tempo normal
    pitch: 0.8,       // Voix plus mature
    volume: 0.8,      // Volume standard
    preferFemale: false // Voix adulte naturelle
  }
} as const;
