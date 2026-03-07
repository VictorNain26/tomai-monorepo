/**
 * Cognitive Profile Service
 *
 * Gère le profil cognitif persistant de l'élève.
 * Le profil est mis à jour par l'agent IA au fil des conversations
 * et utilisé pour personnaliser les réponses pédagogiques.
 */

import { db } from '../db/connection.js';
import {
  studentCognitiveProfiles,
  type StudentCognitiveProfile,
  type CognitiveObservation,
} from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/observability.js';

const MAX_OBSERVATIONS = 50;

export const cognitiveProfileService = {
  /**
   * Récupère le profil cognitif brut d'un élève
   */
  async getProfile(userId: string): Promise<StudentCognitiveProfile | null> {
    try {
      const profile = await db.query.studentCognitiveProfiles.findFirst({
        where: eq(studentCognitiveProfiles.userId, userId),
      });
      return profile ?? null;
    } catch (error) {
      logger.error('Failed to get cognitive profile', {
        operation: 'cognitive-profile:get',
        userId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return null;
    }
  },

  /**
   * Retourne un résumé texte du profil pour injection dans le system prompt
   */
  async getProfileSummary(userId: string): Promise<string | null> {
    const profile = await this.getProfile(userId);
    if (!profile) return null;

    const strengths = profile.strengths as string[] | null;
    const weaknesses = profile.weaknesses as string[] | null;
    const observations = profile.observations as CognitiveObservation[] | null;

    const hasStrengths = strengths !== null && strengths.length > 0;
    const hasWeaknesses = weaknesses !== null && weaknesses.length > 0;
    const hasData = hasStrengths || hasWeaknesses || profile.preferredStyle !== null;

    if (!hasData) return null;

    const parts: string[] = [];

    if (strengths && strengths.length > 0) {
      parts.push(`Points forts: ${strengths.join(', ')}`);
    }
    if (weaknesses && weaknesses.length > 0) {
      parts.push(`Points à travailler: ${weaknesses.join(', ')}`);
    }
    if (profile.preferredStyle) {
      parts.push(`Style préféré: ${profile.preferredStyle}`);
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
   * Met à jour le profil cognitif (upsert)
   */
  async updateProfile(
    userId: string,
    updates: {
      strengths?: string[];
      weaknesses?: string[];
      preferredStyle?: string;
      observation?: string;
      subject?: string;
    }
  ): Promise<void> {
    try {
      const existing = await this.getProfile(userId);

      if (existing) {
        const currentObservations = (existing.observations as CognitiveObservation[]) ?? [];

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
            ...(updates.preferredStyle && { preferredStyle: updates.preferredStyle }),
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
          preferredStyle: updates.preferredStyle,
          observations,
          lastUpdatedByAgent: new Date(),
        });
      }
    } catch (error) {
      logger.error('Failed to update cognitive profile', {
        operation: 'cognitive-profile:update',
        userId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
    }
  },
};
