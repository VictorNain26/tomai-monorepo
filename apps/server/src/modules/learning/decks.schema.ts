import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum, index, foreignKey } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { user, schoolLevelEnum } from '../auth/auth.schema';
import { SUBJECT_SLUGS } from '../../lib/subjects.js';
import { CARD_TYPES } from './card-content.schema.js';

// =============================================
// ENUMS
// =============================================

export const cardTypeEnum = pgEnum('card_type', CARD_TYPES);
export const deckSourceEnum = pgEnum('deck_source', ['prompt', 'conversation', 'document']);
export const subjectEnum = pgEnum('subject', SUBJECT_SLUGS);

// =============================================
// TABLES
// =============================================

/**
 * Learning Decks - Collections de cartes de révision
 *
 * Un "deck" est une collection thématique de cartes.
 * Organisé par matière et adapté au niveau scolaire.
 */
export const learningDecks = pgTable('learning_decks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),

  // Contenu
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  subject: subjectEnum('subject').notNull(),

  // Source de création
  source: deckSourceEnum('source').notNull(),
  sourceId: varchar('source_id', { length: 255 }), // sessionId ou documentId
  sourcePrompt: text('source_prompt'), // Prompt original si source='prompt'

  // Contexte éducatif
  schoolLevel: schoolLevelEnum('school_level'),

  // Compteur de cartes
  cardCount: integer('card_count').notNull().default(0),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'learning_decks_user_id_fkey'
  }).onDelete('cascade'),

  index('idx_learning_decks_user_subject').on(table.userId, table.subject),
  index('idx_learning_decks_user_created').on(table.userId, table.createdAt),
]);

/**
 * Learning Cards - Cartes individuelles de révision
 */
export const learningCards = pgTable('learning_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  deckId: uuid('deck_id').notNull(),

  // Type de carte
  cardType: cardTypeEnum('card_type').notNull(),

  // Contenu (structure JSON selon cardType)
  content: jsonb('content').notNull(),

  // Position dans le deck (pour ordonner)
  position: integer('position').notNull().default(0),

  // Données FSRS cachées (pour ordre optimal des cartes - invisible utilisateur)
  // Structure: { difficulty, stability, due, reps, lapses, state, lastReview }
  fsrsData: jsonb('fsrs_data').default(sql`'{}'::jsonb`),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.deckId],
    foreignColumns: [learningDecks.id],
    name: 'learning_cards_deck_id_fkey'
  }).onDelete('cascade'),

  index('idx_learning_cards_deck_position').on(table.deckId, table.position),
  index('idx_learning_cards_type').on(table.cardType),
]);

// =============================================
// RELATIONS
// =============================================

export const learningDecksRelations = relations(learningDecks, ({ one, many }) => ({
  user: one(user, {
    fields: [learningDecks.userId],
    references: [user.id]
  }),
  cards: many(learningCards),
}));

export const learningCardsRelations = relations(learningCards, ({ one }) => ({
  deck: one(learningDecks, {
    fields: [learningCards.deckId],
    references: [learningDecks.id]
  }),
}));

// =============================================
// TYPES
// =============================================
export type DeckSource = typeof deckSourceEnum.enumValues[number];

export type LearningDeck = typeof learningDecks.$inferSelect;
export type NewLearningDeck = typeof learningDecks.$inferInsert;

export type LearningCard = typeof learningCards.$inferSelect;
export type NewLearningCard = typeof learningCards.$inferInsert;

export type LearningDeckWithRelations = LearningDeck & {
  user?: typeof user.$inferSelect;
  cards?: LearningCard[];
};

export type LearningCardWithRelations = LearningCard & {
  deck?: LearningDeck;
};

// FSRS Data structure (hidden from user)
export interface FSRSData {
  difficulty?: number | undefined;
  stability?: number | undefined;
  due?: string | undefined; // ISO date
  reps?: number | undefined;
  lapses?: number | undefined;
  state?: number | undefined; // 0=new, 1=learning, 2=review, 3=relearning
  lastReview?: string | undefined; // ISO date
}
