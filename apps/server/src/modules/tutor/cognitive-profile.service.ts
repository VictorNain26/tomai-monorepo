/**
 * Cognitive Profile Service
 *
 * Gère le profil cognitif persistant de l'élève.
 * Le profil est mis à jour par l'agent IA au fil des conversations
 * et utilisé pour personnaliser les réponses pédagogiques.
 */

import { db } from '../../db/connection.js';
import {
  studentCognitiveProfiles,
  type StudentCognitiveProfile,
  type CognitiveObservation,
} from './cognitive-profile.schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../platform/observability/logger.js';

const MAX_OBSERVATIONS = 50;

export const cognitiveProfileService = {
  /**
   * Récupère le profil cognitif brut d'un élève
   */
  async getProfile(userId: string): Promise<StudentCognitiveProfile | null> {
    const profile = await db.query.studentCognitiveProfiles.findFirst({
      where: eq(studentCognitiveProfiles.userId, userId),
    });
    return profile ?? null;
  },

  /**
   * Retourne un résumé texte du profil pour injection dans le system prompt
   */
  async getProfileSummary(userId: string): Promise<string | null> {
    // A turn goes on without the profile when it cannot be read; the failure is logged.
    let profile: StudentCognitiveProfile | null;
    try {
      profile = await this.getProfile(userId);
    } catch (error) {
      logger.error('Failed to get cognitive profile', {
        operation: 'cognitive-profile:get',
        userId,
        err: error,
        severity: 'medium' as const,
      });
      return null;
    }
    if (!profile) return null;

    const strengths = profile.strengths as string[] | null;
    const weaknesses = profile.weaknesses as string[] | null;
    const observations = profile.observations as CognitiveObservation[] | null;

    const hasStrengths = strengths !== null && strengths.length > 0;
    const hasWeaknesses = weaknesses !== null && weaknesses.length > 0;
    const hasObservations = observations !== null && observations.length > 0;
    const hasData = hasStrengths || hasWeaknesses || hasObservations;

    if (!hasData) return null;

    const parts: string[] = [];

    if (strengths && strengths.length > 0) {
      parts.push(`Points forts: ${strengths.join(', ')}`);
    }
    if (weaknesses && weaknesses.length > 0) {
      parts.push(`Points à travailler: ${weaknesses.join(', ')}`);
    }
    if (observations && observations.length > 0) {
      const recent = observations.slice(-3);
      parts.push(
        `Observations récentes:\n${recent.map((o) => `- ${o.observation}`).join('\n')}`
      );
    }

    return parts.join('\n');
  },

  /**
   * Met à jour le profil cognitif (upsert). Une lecture ou une écriture qui échoue remonte :
   * fusionner avec un profil lu vide écraserait les forces et difficultés enregistrées.
   */
  async updateProfile(
    userId: string,
    updates: {
      strengths?: string[];
      weaknesses?: string[];
      observation?: string;
      subject?: string;
    }
  ): Promise<void> {
    const existing = await this.getProfile(userId);

    if (existing) {
      const currentObservations = (existing.observations as CognitiveObservation[] | null) ?? [];

      // Append new observation if provided
      let newObservations = currentObservations;
      if (updates.observation) {
        const obs: CognitiveObservation = {
          date: new Date().toISOString(),
          observation: updates.observation,
          subject: updates.subject,
        };
        newObservations = [...currentObservations, obs].slice(-MAX_OBSERVATIONS);
      }

      await db
        .update(studentCognitiveProfiles)
        .set({
          ...(updates.strengths && { strengths: updates.strengths }),
          ...(updates.weaknesses && { weaknesses: updates.weaknesses }),
          observations: newObservations,
          lastUpdatedByAgent: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(studentCognitiveProfiles.userId, userId));
    } else {
      const observations: CognitiveObservation[] = updates.observation
        ? [{
          date: new Date().toISOString(),
          observation: updates.observation,
          subject: updates.subject,
        }]
        : [];

      await db.insert(studentCognitiveProfiles).values({
        userId,
        strengths: updates.strengths ?? [],
        weaknesses: updates.weaknesses ?? [],
        observations,
        lastUpdatedByAgent: new Date(),
      });
    }
  },
};
