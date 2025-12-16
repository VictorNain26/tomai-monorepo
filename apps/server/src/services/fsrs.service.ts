/**
 * Service FSRS (Free Spaced Repetition Scheduler)
 *
 * Implémentation serveur de l'algorithme FSRS avec adaptation par niveau scolaire.
 *
 * FSRS est un algorithme moderne de répétition espacée qui:
 * - Prédit le moment optimal de révision
 * - S'adapte aux performances de l'élève
 * - Maximise la rétention avec un minimum de révisions
 *
 * @see https://github.com/open-spaced-repetition/ts-fsrs
 * @see docs/AUDIT_LEARNING_FLASHCARDS.md
 */

import {
  fsrs,
  createEmptyCard,
  Rating,
  State,
  type Card as FSRSCard,
  type RecordLog,
  type FSRSParameters,
  type Grade,
} from 'ts-fsrs';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { learningCards, learningDecks, type FSRSData } from '../db/schema.js';
import { getLevelConfig } from '../config/learning-config.js';
import type { EducationLevelType } from '../types/index.js';
import { logger } from '../lib/observability.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Résultat de révision d'une carte
 */
export interface ReviewResult {
  cardId: string;
  rating: Rating;
  previousState: State;
  newState: State;
  nextDue: Date;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
}

/**
 * Carte avec données FSRS pour révision
 */
export interface CardForReview {
  id: string;
  deckId: string;
  cardType: string;
  content: unknown;
  position: number;
  fsrsData: FSRSData;
  /** Priorité de révision (plus bas = plus urgent) */
  priority: number;
  /** True si la carte est en retard */
  overdue: boolean;
}

/**
 * Statistiques de révision pour un deck
 */
export interface DeckReviewStats {
  deckId: string;
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  relearningCards: number;
  dueToday: number;
  overdueCards: number;
  averageDifficulty: number;
  averageStability: number;
}

/**
 * Options pour récupérer les cartes dues
 */
export interface GetDueCardsOptions {
  deckId: string;
  userId: string;
  limit?: number;
  includeNew?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE FSRS
// ═══════════════════════════════════════════════════════════════════════════

class FSRSService {
  /**
   * Crée un scheduler FSRS configuré pour un niveau scolaire
   *
   * Les paramètres sont adaptés selon l'âge:
   * - Rétention cible plus basse pour les petits (moins de pression)
   * - Intervalles max plus courts (consolidation fréquente)
   */
  private getScheduler(level: EducationLevelType): ReturnType<typeof fsrs> {
    const config = getLevelConfig(level);

    const params: Partial<FSRSParameters> = {
      request_retention: config.retention,
      maximum_interval: config.maxInterval,
      // Enable short-term scheduling for new cards
      enable_short_term: true,
      // Add some randomness to avoid predictable patterns
      enable_fuzz: true,
    };

    return fsrs(params);
  }

  /**
   * Convertit FSRSData (DB) en Card (ts-fsrs)
   */
  private fsrsDataToCard(data: FSRSData | null | undefined): FSRSCard {
    if (!data || Object.keys(data).length === 0) {
      return createEmptyCard();
    }

    return {
      due: data.due ? new Date(data.due) : new Date(),
      stability: data.stability ?? 0,
      difficulty: data.difficulty ?? 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0, // Required by ts-fsrs Card type
      reps: data.reps ?? 0,
      lapses: data.lapses ?? 0,
      state: (data.state ?? State.New) as State,
      last_review: data.lastReview ? new Date(data.lastReview) : undefined,
    };
  }

  /**
   * Convertit Card (ts-fsrs) en FSRSData (DB)
   */
  private cardToFsrsData(card: FSRSCard): FSRSData {
    return {
      due: card.due.toISOString(),
      stability: card.stability,
      difficulty: card.difficulty,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      lastReview: card.last_review?.toISOString(),
    };
  }

  /**
   * Enregistre une révision de carte
   *
   * @param cardId ID de la carte
   * @param rating Note de l'élève (1=Again, 2=Hard, 3=Good, 4=Easy)
   * @param level Niveau scolaire (pour paramètres FSRS)
   * @returns Résultat de la révision avec nouvelle date
   */
  async reviewCard(
    cardId: string,
    rating: Rating,
    level: EducationLevelType
  ): Promise<ReviewResult> {
    const scheduler = this.getScheduler(level);
    const now = new Date();

    // Récupérer la carte
    const [card] = await db
      .select()
      .from(learningCards)
      .where(eq(learningCards.id, cardId))
      .limit(1);

    if (!card) {
      throw new Error(`Card not found: ${cardId}`);
    }

    // Convertir les données FSRS existantes
    const currentCard = this.fsrsDataToCard(card.fsrsData as FSRSData);
    const previousState = currentCard.state;

    // Calculer le nouveau scheduling
    // Note: RecordLog is indexed by Grade (1-4), not Rating (0-4)
    // Rating.Manual (0) is not used for spaced repetition
    const recordLog: RecordLog = scheduler.repeat(currentCard, now);
    const newCard = recordLog[rating as Grade].card;

    // Convertir pour stockage
    const newFsrsData = this.cardToFsrsData(newCard);

    // Mettre à jour en DB
    await db
      .update(learningCards)
      .set({
        fsrsData: newFsrsData,
        updatedAt: now,
      })
      .where(eq(learningCards.id, cardId));

    logger.info('Card reviewed', {
      cardId,
      rating,
      level,
      previousState,
      newState: newCard.state,
      nextDue: newCard.due.toISOString(),
      stability: newCard.stability,
      operation: 'fsrs-review',
    });

    return {
      cardId,
      rating,
      previousState,
      newState: newCard.state,
      nextDue: newCard.due,
      stability: newCard.stability,
      difficulty: newCard.difficulty,
      reps: newCard.reps,
      lapses: newCard.lapses,
    };
  }

  /**
   * Récupère les cartes dues pour révision
   *
   * Ordre de priorité:
   * 1. Cartes en retard (overdue)
   * 2. Cartes en apprentissage (learning/relearning)
   * 3. Cartes à réviser (review)
   * 4. Nouvelles cartes (new) - si includeNew=true
   */
  async getDueCards(options: GetDueCardsOptions): Promise<CardForReview[]> {
    const { deckId, userId, limit = 20, includeNew = true } = options;
    const now = new Date();

    // Vérifier que le deck appartient à l'utilisateur
    const [deck] = await db
      .select()
      .from(learningDecks)
      .where(and(eq(learningDecks.id, deckId), eq(learningDecks.userId, userId)))
      .limit(1);

    if (!deck) {
      throw new Error(`Deck not found or access denied: ${deckId}`);
    }

    // Récupérer les cartes avec données FSRS
    const cards = await db
      .select()
      .from(learningCards)
      .where(eq(learningCards.deckId, deckId))
      .orderBy(learningCards.position);

    // Filtrer et trier les cartes dues
    const dueCards: CardForReview[] = [];

    for (const card of cards) {
      const fsrsData = card.fsrsData as FSRSData | null;
      const fsrsCard = this.fsrsDataToCard(fsrsData);

      // Carte nouvelle (jamais révisée)
      if (fsrsCard.state === State.New) {
        if (includeNew) {
          dueCards.push({
            id: card.id,
            deckId: card.deckId,
            cardType: card.cardType,
            content: card.content,
            position: card.position,
            fsrsData: fsrsData ?? {},
            priority: 1000 + card.position, // Nouvelles cartes en dernier
            overdue: false,
          });
        }
        continue;
      }

      // Cartes en apprentissage/révision - vérifier si dues
      const dueDate = fsrsCard.due;
      const isDue = dueDate <= now;
      const isOverdue = dueDate < new Date(now.getTime() - 24 * 60 * 60 * 1000);

      if (isDue) {
        // Priorité basée sur l'urgence et l'état
        let priority: number;

        if (isOverdue) {
          // Cartes en retard: priorité maximale
          const daysOverdue = Math.floor(
            (now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)
          );
          priority = -daysOverdue * 10;
        } else if (fsrsCard.state === State.Learning || fsrsCard.state === State.Relearning) {
          // Cartes en apprentissage: haute priorité
          priority = 100;
        } else {
          // Cartes à réviser: priorité normale basée sur stabilité
          priority = 500 + Math.floor(fsrsCard.stability);
        }

        dueCards.push({
          id: card.id,
          deckId: card.deckId,
          cardType: card.cardType,
          content: card.content,
          position: card.position,
          fsrsData: fsrsData ?? {},
          priority,
          overdue: isOverdue,
        });
      }
    }

    // Trier par priorité (plus bas = plus urgent)
    dueCards.sort((a, b) => a.priority - b.priority);

    // Limiter le nombre de cartes
    return dueCards.slice(0, limit);
  }

  /**
   * Récupère les statistiques de révision d'un deck
   */
  async getDeckStats(deckId: string, userId: string): Promise<DeckReviewStats> {
    const now = new Date();

    // Vérifier accès
    const [deck] = await db
      .select()
      .from(learningDecks)
      .where(and(eq(learningDecks.id, deckId), eq(learningDecks.userId, userId)))
      .limit(1);

    if (!deck) {
      throw new Error(`Deck not found or access denied: ${deckId}`);
    }

    // Récupérer toutes les cartes
    const cards = await db
      .select()
      .from(learningCards)
      .where(eq(learningCards.deckId, deckId));

    // Calculer les statistiques
    let newCards = 0;
    let learningCardsCount = 0;
    let reviewCards = 0;
    let relearningCards = 0;
    let dueToday = 0;
    let overdueCards = 0;
    let totalDifficulty = 0;
    let totalStability = 0;
    let cardsWithStats = 0;

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    for (const card of cards) {
      const fsrsData = card.fsrsData as FSRSData | null;
      const fsrsCard = this.fsrsDataToCard(fsrsData);

      switch (fsrsCard.state) {
        case State.New:
          newCards++;
          break;
        case State.Learning:
          learningCardsCount++;
          break;
        case State.Review:
          reviewCards++;
          break;
        case State.Relearning:
          relearningCards++;
          break;
      }

      // Cartes dues
      if (fsrsCard.state !== State.New) {
        if (fsrsCard.due <= todayEnd) {
          dueToday++;
        }
        if (fsrsCard.due < now) {
          overdueCards++;
        }

        totalDifficulty += fsrsCard.difficulty;
        totalStability += fsrsCard.stability;
        cardsWithStats++;
      }
    }

    return {
      deckId,
      totalCards: cards.length,
      newCards,
      learningCards: learningCardsCount,
      reviewCards,
      relearningCards,
      dueToday,
      overdueCards,
      averageDifficulty: cardsWithStats > 0 ? totalDifficulty / cardsWithStats : 0,
      averageStability: cardsWithStats > 0 ? totalStability / cardsWithStats : 0,
    };
  }

  /**
   * Initialise les données FSRS pour une nouvelle carte
   *
   * Appelé lors de la création de cartes pour s'assurer
   * qu'elles ont des données FSRS valides
   */
  initializeCardFsrsData(): FSRSData {
    const emptyCard = createEmptyCard();
    return this.cardToFsrsData(emptyCard);
  }

  /**
   * Prédit les prochaines révisions pour simulation
   *
   * Utile pour afficher à l'élève le planning de révision prévu
   * Returns scheduling preview for grades 1-4 (Again, Hard, Good, Easy)
   */
  previewScheduling(
    level: EducationLevelType,
    currentFsrsData: FSRSData | null
  ): Record<Grade, { due: Date; interval: number }> {
    const scheduler = this.getScheduler(level);
    const currentCard = this.fsrsDataToCard(currentFsrsData);
    const now = new Date();

    const recordLog = scheduler.repeat(currentCard, now);

    // Grade enum: 1=Again, 2=Hard, 3=Good, 4=Easy (excludes Manual=0)
    return {
      [Rating.Again]: {
        due: recordLog[Rating.Again].card.due,
        interval: recordLog[Rating.Again].card.scheduled_days,
      },
      [Rating.Hard]: {
        due: recordLog[Rating.Hard].card.due,
        interval: recordLog[Rating.Hard].card.scheduled_days,
      },
      [Rating.Good]: {
        due: recordLog[Rating.Good].card.due,
        interval: recordLog[Rating.Good].card.scheduled_days,
      },
      [Rating.Easy]: {
        due: recordLog[Rating.Easy].card.due,
        interval: recordLog[Rating.Easy].card.scheduled_days,
      },
    } as Record<Grade, { due: Date; interval: number }>;
  }

  /**
   * Reset les données FSRS d'une carte (remet à neuf)
   */
  async resetCard(cardId: string): Promise<void> {
    const emptyFsrsData = this.initializeCardFsrsData();

    await db
      .update(learningCards)
      .set({
        fsrsData: emptyFsrsData,
        updatedAt: new Date(),
      })
      .where(eq(learningCards.id, cardId));

    logger.info('Card FSRS data reset', {
      cardId,
      operation: 'fsrs-reset',
    });
  }

  /**
   * Reset toutes les cartes d'un deck
   */
  async resetDeck(deckId: string, userId: string): Promise<number> {
    // Vérifier accès
    const [deck] = await db
      .select()
      .from(learningDecks)
      .where(and(eq(learningDecks.id, deckId), eq(learningDecks.userId, userId)))
      .limit(1);

    if (!deck) {
      throw new Error(`Deck not found or access denied: ${deckId}`);
    }

    const emptyFsrsData = this.initializeCardFsrsData();

    await db
      .update(learningCards)
      .set({
        fsrsData: emptyFsrsData,
        updatedAt: new Date(),
      })
      .where(eq(learningCards.deckId, deckId));

    logger.info('Deck FSRS data reset', {
      deckId,
      operation: 'fsrs-reset-deck',
    });

    // Retourner le nombre de cartes affectées
    return deck.cardCount;
  }
}

// Export singleton
export const fsrsService = new FSRSService();

// Export du type Rating pour usage externe
export { Rating, State };
