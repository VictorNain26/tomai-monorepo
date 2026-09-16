import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum, index, foreignKey } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { user, schoolLevelEnum } from './auth.schema';

// =============================================
// ENUMS
// =============================================

export const cardTypeEnum = pgEnum('card_type', [
  // Pedagogical (theory before practice)
  'concept',
  // Universal (all subjects)
  'flashcard', 'qcm', 'vrai_faux',
  // Languages (LV1, LV2)
  'matching', 'fill_blank', 'word_order',
  // Math/Sciences
  'calculation',
  // History-Geography
  'timeline', 'matching_era', 'cause_effect',
  // SVT/Sciences
  'classification', 'process_order',
  // French
  'grammar_transform',
  // Cognitive Science - Elaboration (2025)
  'reformulation'
]);
export const deckSourceEnum = pgEnum('deck_source', ['prompt', 'conversation', 'document', 'rag_program']);

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
  subject: varchar('subject', { length: 100 }).notNull(),

  // Source de création
  source: deckSourceEnum('source').notNull(),
  sourceId: varchar('source_id', { length: 255 }), // sessionId, documentId, ou programId
  sourcePrompt: text('source_prompt'), // Prompt original si source='prompt'

  // Contexte éducatif
  schoolLevel: schoolLevelEnum('school_level'),

  // Compteur de cartes
  cardCount: integer('card_count').notNull().default(0),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'learning_decks_user_id_fkey'
  }).onDelete('cascade'),

  userSubjectIdx: index('idx_learning_decks_user_subject').on(table.userId, table.subject),
  userCreatedIdx: index('idx_learning_decks_user_created').on(table.userId, table.createdAt),
}));

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
}, (table) => ({
  deckIdFk: foreignKey({
    columns: [table.deckId],
    foreignColumns: [learningDecks.id],
    name: 'learning_cards_deck_id_fkey'
  }).onDelete('cascade'),

  deckPositionIdx: index('idx_learning_cards_deck_position').on(table.deckId, table.position),
  cardTypeIdx: index('idx_learning_cards_type').on(table.cardType),
}));

/**
 * Table student_cognitive_profiles - Profil cognitif persistant
 *
 * Mis à jour par l'agent IA au fil des conversations.
 * Utilisé pour personnaliser les réponses pédagogiques.
 */
export const studentCognitiveProfiles = pgTable('student_cognitive_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().unique(),

  // Profil cognitif (mis à jour par l'agent)
  strengths: jsonb('strengths').default(sql`'[]'::jsonb`),
  weaknesses: jsonb('weaknesses').default(sql`'[]'::jsonb`),
  preferredStyle: varchar('preferred_style', { length: 50 }),

  // Historique des observations (append-only, max 50 entries)
  observations: jsonb('observations').default(sql`'[]'::jsonb`),

  // Timestamps
  lastUpdatedByAgent: timestamp('last_updated_by_agent', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'student_cognitive_profiles_user_id_fkey'
  }).onDelete('cascade'),

  userIdIdx: index('idx_student_cognitive_profiles_user_id').on(table.userId),
}));

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

export const studentCognitiveProfilesRelations = relations(studentCognitiveProfiles, ({ one }) => ({
  user: one(user, {
    fields: [studentCognitiveProfiles.userId],
    references: [user.id]
  }),
}));

// =============================================
// TYPES
// =============================================
export type CardType = typeof cardTypeEnum.enumValues[number];
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

// Card Content Types (JSON structure)
export interface FlashcardContent {
  front: string;
  back: string;
}

export interface QCMContent {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface VraiFauxContent {
  statement: string;
  isTrue: boolean;
  explanation?: string;
}

export type CardContent = FlashcardContent | QCMContent | VraiFauxContent;

// FSRS Data structure (hidden from user)
export interface FSRSData {
  difficulty?: number;
  stability?: number;
  due?: string; // ISO date
  reps?: number;
  lapses?: number;
  state?: number; // 0=new, 1=learning, 2=review, 3=relearning
  lastReview?: string; // ISO date
}

// Cognitive Profile Types
export type StudentCognitiveProfile = typeof studentCognitiveProfiles.$inferSelect;
export type NewStudentCognitiveProfile = typeof studentCognitiveProfiles.$inferInsert;

export interface CognitiveObservation {
  date: string;
  observation: string;
  subject?: string;
}
