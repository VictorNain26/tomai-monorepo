/**
 * Better Auth + TomAI Unified Schema
 * Schema optimisé combinant Better Auth et spécificités TomAI
 * Remplace complètement l'ancien système d'authentification
 */

import { pgTable, uuid, varchar, text, timestamp, boolean, integer, decimal, jsonb, pgEnum, index, foreignKey, unique, real } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// =============================================
// ENUMS - Types éducatifs TomAI
// =============================================
export const schoolLevelEnum = pgEnum('school_level', [
  'cp', 'ce1', 'ce2', 'cm1', 'cm2',                    // Primaire
  'sixieme', 'cinquieme', 'quatrieme', 'troisieme',    // Collège
  'seconde', 'premiere', 'terminale'                    // Lycée
]);

export const userRoleEnum = pgEnum('user_role', ['student', 'parent', 'admin']);
export const sessionStatusEnum = pgEnum('session_status', ['draft', 'active', 'paused', 'completed', 'abandoned', 'timeout', 'error']);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);

// AI Model: TEXT au lieu d'ENUM - flexibilité pour nouveaux modèles sans migration
// TypeScript type défini plus bas pour type-safety


// =============================================
// ESTABLISHMENT SEARCH ENUMS
// =============================================
export const establishmentTypeEnum = pgEnum('establishment_type', [
  'college',
  'lycee',
  'lycee_general_technologique',
  'lycee_professionnel',
  'lycee_polyvalent',
  'lycee_agricole',
  'etablissement_regional_enseignement_adapte',
  'cite_scolaire',
  'autre'
]);

export const establishmentStatusEnum = pgEnum('establishment_status', ['ouvert', 'ferme', 'a_ouvrir']);

// =============================================
// BETTER AUTH CORE TABLES
// =============================================

/**
 * Table user - Better Auth standard + extensions TomAI
 * Configuration alignée avec Better Auth v1.3.7 + plugin username
 */
export const user = pgTable('user', {
  // ===== BETTER AUTH CORE FIELDS (REQUIS) =====
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }), // Better Auth utilise 'name' comme displayName
  email: varchar('email', { length: 320 }).unique(),
  emailVerified: boolean('email_verified').default(false),
  image: varchar('image', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

  // ===== BETTER AUTH USERNAME PLUGIN FIELDS =====
  username: varchar('username', { length: 50 }).unique(), // Plugin username pour élèves
  displayUsername: varchar('display_username', { length: 50 }).unique(), // Plugin username normalisé

  // ===== TOMAI ADDITIONAL FIELDS (alignés avec auth.ts) =====
  firstName: varchar('first_name', { length: 100 }), // Prénom séparé du 'name'
  lastName: varchar('last_name', { length: 100 }),   // Nom séparé du 'name'
  role: userRoleEnum('role').notNull().default('parent'), // Défaut parent (comme auth.ts)
  schoolLevel: schoolLevelEnum('school_level'), // Niveau scolaire pour élèves
  selectedLv2: varchar('selected_lv2', { length: 50 }), // LV2 choisie (espagnol, allemand, italien) - à partir de 5ème
  dateOfBirth: varchar('date_of_birth', { length: 10 }), // Format YYYY-MM-DD string (comme auth.ts)
  parentId: varchar('parent_id', { length: 255 }), // Référence parent-enfant
  isActive: boolean('is_active').notNull().default(true), // État du compte
  loginCount: integer('login_count').default(0), // Compteur de connexions

  // ===== METADATA ET PREFERENCES =====
  preferences: jsonb('preferences').default(sql`'{"theme": "light", "language": "fr", "notifications": true, "adaptive_difficulty": true}'::jsonb`),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),

  // ===== STRIPE SUBSCRIPTION FIELDS =====
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }), // Stripe Customer ID
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }), // Stripe Subscription ID
  subscriptionStatus: varchar('subscription_status', { length: 50 }).default('inactive'), // active, past_due, canceled, etc.
  subscriptionPlan: varchar('subscription_plan', { length: 50 }).default('free'), // free, student, family

  // ===== LOCALISATION =====
  countryCode: varchar('country_code', { length: 2 }).default('FR'),
  timezone: varchar('timezone', { length: 50 }).default('Europe/Paris'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
}, (table) => ({
  // Index pour performance
  emailIdx: index('idx_user_email').on(table.email),
  usernameIdx: index('idx_user_username').on(table.username),
  parentIdIdx: index('idx_user_parent_id').on(table.parentId),
  roleIdx: index('idx_user_role').on(table.role),
  schoolLevelIdx: index('idx_user_school_level').on(table.schoolLevel),
  stripeCustomerIdx: index('idx_user_stripe_customer_id').on(table.stripeCustomerId),

  // Self-referencing foreign key pour parent-child
  parentIdFk: foreignKey({
    columns: [table.parentId],
    foreignColumns: [table.id],
    name: 'user_parent_id_fkey'
  }).onDelete('set null'),
}));

/**
 * Table session - Better Auth standard
 */
export const session = pgTable('session', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'session_user_id_fkey'
  }).onDelete('cascade'),

  tokenIdx: index('idx_session_token').on(table.token),
  userIdIdx: index('idx_session_user_id').on(table.userId),
  expiresAtIdx: index('idx_session_expires_at').on(table.expiresAt),
}));

/**
 * Table account - Better Auth OAuth providers
 */
export const account = pgTable('account', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  accountId: varchar('account_id', { length: 255 }).notNull(),
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'), // Required by Better Auth for Google OAuth
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: varchar('scope', { length: 255 }),
  password: varchar('password', { length: 255 }), // Pour email/password auth
  salt: varchar('salt', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'account_user_id_fkey'
  }).onDelete('cascade'),

  userIdIdx: index('idx_account_user_id').on(table.userId),
  providerAccountIdx: index('idx_account_provider_account').on(table.providerId, table.accountId),
}));

/**
 * Table verification - Better Auth tokens
 */
export const verification = pgTable('verification', {
  id: varchar('id', { length: 255 }).primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: text('value').notNull(), // TEXT requis par Better Auth pour OAuth tokens (JSON > 255 chars)
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  identifierIdx: index('idx_verification_identifier').on(table.identifier),
}));

// =============================================
// ESTABLISHMENT SEARCH TABLES
// =============================================

/**
 * Table establishments - Base locale des établissements scolaires français
 * Synchronisée depuis l'API Education Nationale avec Full-Text Search PostgreSQL
 */
export const establishments = pgTable('establishments', {
  // ===== IDENTIFICATION UNIQUE =====
  rne: varchar('rne', { length: 8 }).primaryKey(), // Répertoire National des Établissements

  // ===== INFORMATIONS DE BASE =====
  name: varchar('name', { length: 300 }).notNull(), // Nom complet établissement
  normalizedName: varchar('normalized_name', { length: 300 }).notNull(), // Nom normalisé pour recherche
  type: establishmentTypeEnum('type').notNull(),
  status: establishmentStatusEnum('status').notNull().default('ouvert'),

  // ===== ADRESSE ET LOCALISATION =====
  address1: varchar('address1', { length: 200 }), // Adresse ligne 1
  address2: varchar('address2', { length: 200 }), // Adresse ligne 2 (optionnelle)
  address3: varchar('address3', { length: 200 }), // Adresse ligne 3 (optionnelle)
  fullAddress: varchar('full_address', { length: 600 }).notNull(), // Adresse complète formatée
  city: varchar('city', { length: 100 }).notNull(),
  postalCode: varchar('postal_code', { length: 5 }).notNull(),
  department: varchar('department', { length: 100 }).notNull(),
  departmentCode: varchar('department_code', { length: 3 }).notNull(),
  academy: varchar('academy', { length: 100 }).notNull(),

  // ===== GÉOLOCALISATION =====
  latitude: real('latitude'), // Coordonnées GPS pour recherche géographique
  longitude: real('longitude'),

  // ===== INFORMATIONS ADMINISTRATIVES =====
  publicPrivate: varchar('public_private', { length: 20 }), // Public/Privé
  ministerialCode: varchar('ministerial_code', { length: 20 }), // Code ministériel
  siret: varchar('siret', { length: 14 }), // SIRET de l'établissement

  // ===== PRONOTE CONFIGURATION =====
  pronoteUrl: varchar('pronote_url', { length: 400 }).notNull(), // URL Pronote générée
  hasPronote: boolean('has_pronote').notNull().default(true), // Pronote disponible
  pronoteCheckedAt: timestamp('pronote_checked_at', { withTimezone: true }), // Dernière vérification Pronote

  // ===== ENSEIGNEMENT =====
  voieGenerale: boolean('voie_generale').default(false), // Voie générale
  voieTechnologique: boolean('voie_technologique').default(false), // Voie technologique
  voieProfessionnelle: boolean('voie_professionnelle').default(false), // Voie professionnelle

  // ===== MÉTADONNÉES RECHERCHE =====
  searchTerms: text('search_terms').notNull(), // Termes de recherche concaténés
  // Note: searchVector sera ajouté via migration SQL pour éviter les problèmes Drizzle ORM

  // ===== QUALITÉ DONNÉES =====
  dataQuality: integer('data_quality').default(100), // Score qualité 0-100
  isValidated: boolean('is_validated').default(false), // Validation manuelle
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  validatedBy: varchar('validated_by', { length: 255 }), // Qui a validé

  // ===== SYNCHRONISATION =====
  sourceApi: varchar('source_api', { length: 50 }).notNull().default('education_nationale'), // Source des données
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }).notNull().defaultNow(), // Dernière sync
  syncVersion: integer('sync_version').notNull().default(1), // Version de sync
  dataHash: varchar('data_hash', { length: 64 }), // Hash pour détecter changements

  // ===== AUDIT ET MÉTADONNÉES =====
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`), // Métadonnées flexibles
  syncMetadata: jsonb('sync_metadata').default(sql`'{}'::jsonb`), // Métadonnées de synchronisation
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // ===== INDEX FULL-TEXT SEARCH =====
  // Full-text search vector sera ajouté via migration SQL si nécessaire
  // searchVectorIdx: index('idx_establishments_search_vector').using('gin', sql`(${table.searchVector})`),

  // ===== INDEX GÉOGRAPHIQUES =====
  locationIdx: index('idx_establishments_location').on(table.latitude, table.longitude),
  cityIdx: index('idx_establishments_city').on(table.city),
  postalCodeIdx: index('idx_establishments_postal_code').on(table.postalCode),
  departmentIdx: index('idx_establishments_department').on(table.departmentCode),
  academyIdx: index('idx_establishments_academy').on(table.academy),

  // ===== INDEX FONCTIONNELS =====
  typeStatusIdx: index('idx_establishments_type_status').on(table.type, table.status),
  nameIdx: index('idx_establishments_name').on(table.normalizedName),
  hasPronoteIdx: index('idx_establishments_has_pronote').on(table.hasPronote),

  // ===== INDEX SYNCHRONISATION =====
  lastSyncIdx: index('idx_establishments_last_sync').on(table.lastSyncAt),
  dataQualityIdx: index('idx_establishments_data_quality').on(table.dataQuality),
  isValidatedIdx: index('idx_establishments_is_validated').on(table.isValidated),

  // ===== INDEX COMPOSITES POUR PERFORMANCE =====
  searchCompositeIdx: index('idx_establishments_search_composite').on(
    table.type,
    table.status,
    table.hasPronote
  ),
  locationCompositeIdx: index('idx_establishments_location_composite').on(
    table.departmentCode,
    table.city,
    table.type
  ),
}));


// =============================================
// PRONOTE INTEGRATION (Parent-based architecture)
// =============================================

/**
 * Enum pour le statut de connexion Pronote
 */
export const pronoteConnectionStatusEnum = pgEnum('pronote_connection_status', [
  'active',      // Connexion active et fonctionnelle
  'expired',     // Token expiré, nécessite reconnexion
  'error',       // Erreur lors du refresh
  'disconnected' // Déconnecté manuellement
]);

/**
 * Table pronote_connections - Connexions Pronote des PARENTS
 *
 * Architecture parent-based (2025):
 * - Un parent se connecte avec son compte Pronote parent
 * - Le compte parent contient tous les enfants (resources[])
 * - Les mappings enfant Pronote → enfant TomAI sont dans pronote_child_mappings
 *
 * Sécurité:
 * - Token chiffré AES-256-GCM (jamais en clair)
 * - Clé de chiffrement dans PRONOTE_ENCRYPTION_KEY
 * - Refresh automatique toutes les 5 minutes
 */
export const pronoteConnections = pgTable('pronote_connections', {
  id: uuid('id').primaryKey().defaultRandom(),

  // ===== RELATIONS =====
  parentId: varchar('parent_id', { length: 255 }).notNull().unique(), // Le parent TomAI
  establishmentRne: varchar('establishment_rne', { length: 8 }).notNull(), // Établissement

  // ===== PRONOTE AUTH DATA (chiffré) =====
  encryptedToken: text('encrypted_token').notNull(),
  instanceUrl: varchar('instance_url', { length: 400 }).notNull(),
  pronoteUsername: varchar('pronote_username', { length: 100 }).notNull(),
  deviceUuid: varchar('device_uuid', { length: 36 }).notNull(),
  // Type de compte Pronote: PARENT = 7 (Pawnote AccountKind.PARENT)
  accountKind: integer('account_kind').notNull().default(7),

  // ===== PRONOTE RESOURCES (enfants du compte parent) =====
  // Array des enfants disponibles dans le compte Pronote parent
  // Structure: [{ name: string, id: string, className: string }]
  pronoteResources: jsonb('pronote_resources').default(sql`'[]'::jsonb`),

  // ===== STATUS =====
  status: pronoteConnectionStatusEnum('status').notNull().default('active'),
  lastError: text('last_error'),

  // ===== TIMING =====
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }).notNull(),
  lastRefreshAt: timestamp('last_refresh_at', { withTimezone: true }).notNull().defaultNow(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),

  // ===== AUDIT =====
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  parentIdFk: foreignKey({
    columns: [table.parentId],
    foreignColumns: [user.id],
    name: 'pronote_connections_parent_id_fkey'
  }).onDelete('cascade'),

  establishmentRneFk: foreignKey({
    columns: [table.establishmentRne],
    foreignColumns: [establishments.rne],
    name: 'pronote_connections_establishment_rne_fkey'
  }).onDelete('restrict'),

  statusIdx: index('idx_pronote_connections_status').on(table.status),
  tokenExpiresIdx: index('idx_pronote_connections_expires').on(table.tokenExpiresAt),
  establishmentIdx: index('idx_pronote_connections_establishment').on(table.establishmentRne),
}));

/**
 * Table pronote_child_mappings - Mapping enfant Pronote → enfant TomAI
 *
 * Lie un enfant du compte Pronote parent (par son index dans resources[])
 * à un enfant TomAI (par son userId).
 *
 * Permet de:
 * - Mapper plusieurs enfants Pronote à plusieurs enfants TomAI
 * - Utiliser use(session, resourceIndex) pour accéder aux données de chaque enfant
 * - Synchroniser les devoirs, notes, EDT par enfant
 */
export const pronoteChildMappings = pgTable('pronote_child_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),

  // ===== RELATIONS =====
  connectionId: uuid('connection_id').notNull(), // La connexion parent Pronote
  childId: varchar('child_id', { length: 255 }).notNull(), // L'enfant TomAI

  // ===== PRONOTE RESOURCE DATA =====
  // Index dans le tableau resources[] du compte parent Pronote
  resourceIndex: integer('resource_index').notNull(),
  // Nom de l'enfant dans Pronote (pour affichage/debug)
  pronoteChildName: varchar('pronote_child_name', { length: 200 }).notNull(),
  // Classe de l'enfant dans Pronote
  pronoteClassName: varchar('pronote_class_name', { length: 100 }),

  // ===== SYNC METADATA =====
  lastHomeworkSync: timestamp('last_homework_sync', { withTimezone: true }),
  lastGradesSync: timestamp('last_grades_sync', { withTimezone: true }),
  lastTimetableSync: timestamp('last_timetable_sync', { withTimezone: true }),

  // ===== AUDIT =====
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  connectionIdFk: foreignKey({
    columns: [table.connectionId],
    foreignColumns: [pronoteConnections.id],
    name: 'pronote_child_mappings_connection_id_fkey'
  }).onDelete('cascade'),

  childIdFk: foreignKey({
    columns: [table.childId],
    foreignColumns: [user.id],
    name: 'pronote_child_mappings_child_id_fkey'
  }).onDelete('cascade'),

  // Un enfant TomAI ne peut être mappé qu'une seule fois par connexion
  connectionChildUnique: unique('pronote_child_mappings_connection_child_unique')
    .on(table.connectionId, table.childId),

  // Index pour queries fréquentes
  connectionIdx: index('idx_pronote_child_mappings_connection').on(table.connectionId),
  childIdx: index('idx_pronote_child_mappings_child').on(table.childId),
}));

// =============================================
// TOMAI LEARNING TABLES (conservées)
// =============================================

/**
 * Table study_sessions - Sessions d'apprentissage TomAI
 */
export const studySessions = pgTable('study_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),

  // Détails pédagogiques
  subject: varchar('subject', { length: 100 }).notNull(),
  topic: varchar('topic', { length: 200 }),
  status: sessionStatusEnum('status').notNull().default('active'),

  // Timing
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),

  // Métriques pédagogiques
  frustrationAvg: decimal('frustration_avg', { precision: 3, scale: 2 }).default('0'),
  frustrationMin: decimal('frustration_min', { precision: 3, scale: 2 }).default('0'),
  frustrationMax: decimal('frustration_max', { precision: 3, scale: 2 }).default('0'),
  questionLevelsAvg: decimal('question_levels_avg', { precision: 3, scale: 2 }).default('0'),
  conceptsCovered: text('concepts_covered').array().default(sql`'{}'::text[]`),

  // Métriques Socratiques
  socraticEffectiveness: decimal('socratic_effectiveness', { precision: 3, scale: 2 }).default('0'),
  studentEngagement: decimal('student_engagement', { precision: 3, scale: 2 }).default('0'),
  questionsAsked: integer('questions_asked').default(0),
  questionsAnswered: integer('questions_answered').default(0),
  hintsGiven: integer('hints_given').default(0),

  // Métriques techniques - TEXT pour flexibilité (pas d'ENUM = pas de migration par modèle)
  aiModelUsed: text('ai_model_used').notNull().default('gemini-3-flash'),
  totalTokensUsed: integer('total_tokens_used').default(0),
  apiCostCents: integer('api_cost_cents').default(0),
  averageResponseTimeMs: integer('average_response_time_ms'),

  // Device et contexte
  deviceType: varchar('device_type', { length: 20 }),

  // Évaluation utilisateur
  userSatisfaction: integer('user_satisfaction'),
  sessionRating: integer('session_rating'),

  // Métadonnées
  // CRITICAL FIX: JSONB default must use sql`'{}'::jsonb` NOT .default({})
  // See: https://orm.drizzle.team/docs/column-types/pg#default-value
  sessionMetadata: jsonb('session_metadata').default(sql`'{}'::jsonb`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'study_sessions_user_id_fkey'
  }).onDelete('cascade'),

  userStatusIdx: index('idx_sessions_user_status').on(table.userId, table.status),
  userSubjectDateIdx: index('idx_sessions_user_subject_date').on(table.userId, table.subject, table.startedAt),
  activeIdx: index('idx_sessions_active').on(table.startedAt),
}));

/**
 * Table messages - Messages de chat TomAI
 */
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull(),

  // Contenu
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  contentHash: varchar('content_hash', { length: 64 }),

  // Métriques pédagogiques
  frustrationLevel: integer('frustration_level'),
  questionLevel: integer('question_level'),
  socraticLevel: integer('socratic_level'),

  // Classification
  messageCategory: varchar('message_category', { length: 50 }),

  // Métriques techniques - TEXT pour flexibilité
  aiModel: text('ai_model'),
  tokensUsed: integer('tokens_used').default(0),
  responseTimeMs: integer('response_time_ms'),

  // Qualité
  messageQualityScore: decimal('message_quality_score', { precision: 3, scale: 2 }),
  isHelpful: boolean('is_helpful'),

  // Sécurité
  containsPii: boolean('contains_pii').default(false),
  isFlagged: boolean('is_flagged').default(false),

  // Fichiers attachés (nouveau)
  attachedFile: jsonb('attached_file'), // { fileName: string, fileId?: string, geminiFileId?: string, mimeType?: string }

  // Métadonnées
  messageMetadata: jsonb('message_metadata').default(sql`'{}'::jsonb`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sessionIdFk: foreignKey({
    columns: [table.sessionId],
    foreignColumns: [studySessions.id],
    name: 'messages_session_id_fkey'
  }).onDelete('cascade'),

  sessionCreatedIdx: index('idx_messages_session_created').on(table.sessionId, table.createdAt),
  qualityIdx: index('idx_messages_quality').on(table.messageQualityScore),
}));

/**
 * Table progress - Progression pédagogique
 */
export const progress = pgTable('progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),

  // Domaine d'apprentissage
  subject: varchar('subject', { length: 100 }).notNull(),
  concept: varchar('concept', { length: 200 }).notNull(),
  competencyDomain: varchar('competency_domain', { length: 10 }),

  // Métriques de progression
  masteryLevel: integer('mastery_level').notNull(),
  totalPracticeTime: integer('total_practice_time').notNull().default(0),
  successRate: decimal('success_rate', { precision: 5, scale: 2 }),

  // Historique de progression
  progressHistory: jsonb('progress_history').default(sql`'[]'::jsonb`),

  // Timing
  firstPracticed: timestamp('first_practiced', { withTimezone: true }).notNull().defaultNow(),
  lastPracticed: timestamp('last_practiced', { withTimezone: true }).notNull().defaultNow(),

  // Métadonnées
  progressMetadata: jsonb('progress_metadata').default(sql`'{}'::jsonb`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'progress_user_id_fkey'
  }).onDelete('cascade'),

  userSubjectConceptUnique: unique('progress_user_id_subject_concept_key').on(table.userId, table.subject, table.concept),

  userIdIdx: index('idx_progress_user_id').on(table.userId),
  subjectIdx: index('idx_progress_subject').on(table.subject),
  masteryLevelIdx: index('idx_progress_mastery_level').on(table.masteryLevel),
}));

/**
 * Table cost_tracking - Suivi des coûts AI
 */
export const costTracking = pgTable('cost_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }),
  sessionId: uuid('session_id'),

  // Modèle et coûts - TEXT pour flexibilité
  aiModel: text('ai_model').notNull(),
  operation: varchar('operation', { length: 50 }).notNull().default('chat'),
  tokensInput: integer('tokens_input').notNull().default(0),
  tokensOutput: integer('tokens_output').notNull().default(0),
  costCents: integer('cost_cents').notNull().default(0),

  // Métadonnées de facturation
  billingMetadata: jsonb('billing_metadata').default(sql`'{}'::jsonb`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'cost_tracking_user_id_fkey'
  }).onDelete('set null'),
  sessionIdFk: foreignKey({
    columns: [table.sessionId],
    foreignColumns: [studySessions.id],
    name: 'cost_tracking_session_id_fkey'
  }).onDelete('set null'),

  userIdIdx: index('idx_cost_tracking_user_id').on(table.userId),
  createdAtIdx: index('idx_cost_tracking_created_at').on(table.createdAt),
}));

// =============================================
// RELATIONS DRIZZLE
// =============================================

export const userRelations = relations(user, ({ one, many }) => ({
  // Parent-child relationships
  parent: one(user, {
    fields: [user.parentId],
    references: [user.id],
    relationName: 'parent_child'
  }),
  children: many(user, {
    relationName: 'parent_child'
  }),

  // Auth relationships
  sessions: many(session),
  accounts: many(account),

  // Learning relationships
  studySessions: many(studySessions),
  progress: many(progress),
  costTracking: many(costTracking),

  // Learning Tools (Flashcards, QCM, Vrai/Faux)
  learningDecks: many(learningDecks),

  // Pronote Integration (parent-based architecture)
  // Parent has the connection
  pronoteConnection: one(pronoteConnections, {
    fields: [user.id],
    references: [pronoteConnections.parentId],
  }),
  // Child has mappings to parent's connection
  pronoteChildMappings: many(pronoteChildMappings),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id]
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id]
  }),
}));

export const studySessionsRelations = relations(studySessions, ({ one, many }) => ({
  user: one(user, {
    fields: [studySessions.userId],
    references: [user.id]
  }),
  messages: many(messages),
  costTracking: many(costTracking),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(studySessions, {
    fields: [messages.sessionId],
    references: [studySessions.id]
  }),
}));

export const progressRelations = relations(progress, ({ one }) => ({
  user: one(user, {
    fields: [progress.userId],
    references: [user.id]
  }),
}));

export const costTrackingRelations = relations(costTracking, ({ one }) => ({
  user: one(user, {
    fields: [costTracking.userId],
    references: [user.id]
  }),
  session: one(studySessions, {
    fields: [costTracking.sessionId],
    references: [studySessions.id]
  }),
}));

export const pronoteConnectionsRelations = relations(pronoteConnections, ({ one, many }) => ({
  parent: one(user, {
    fields: [pronoteConnections.parentId],
    references: [user.id]
  }),
  establishment: one(establishments, {
    fields: [pronoteConnections.establishmentRne],
    references: [establishments.rne]
  }),
  childMappings: many(pronoteChildMappings),
}));

export const pronoteChildMappingsRelations = relations(pronoteChildMappings, ({ one }) => ({
  connection: one(pronoteConnections, {
    fields: [pronoteChildMappings.connectionId],
    references: [pronoteConnections.id]
  }),
  child: one(user, {
    fields: [pronoteChildMappings.childId],
    references: [user.id]
  }),
}));



// =============================================
// SUBSCRIPTION SYSTEM TABLES
// =============================================

/**
 * Enum for subscription plan types
 */
export const subscriptionPlanTypeEnum = pgEnum('subscription_plan_type', ['free', 'premium']);

/**
 * Enum for subscription status
 */
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'paused', 'cancelled', 'expired']);

/**
 * Table subscription_plans - Définition des plans d'abonnement
 *
 * Modèle de tarification TomIA:
 * - Free: 5000 tokens/jour, 1 enfant max
 * - Premium: 50000 tokens/jour par enfant, tarification par enfant (15€ + 5€)
 */
export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(), // 'free' | 'premium'
  type: subscriptionPlanTypeEnum('type').notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),

  // Token quotas
  dailyTokenLimit: integer('daily_token_limit').notNull(),
  resetIntervalHours: integer('reset_interval_hours').notNull().default(24),

  // Pricing (en centimes)
  priceFirstChildCents: integer('price_first_child_cents').notNull().default(0),
  priceAdditionalChildCents: integer('price_additional_child_cents').notNull().default(0),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),

  // Stripe IDs
  stripeProductId: varchar('stripe_product_id', { length: 255 }),
  stripePriceIdFirstChild: varchar('stripe_price_id_first_child', { length: 255 }),
  stripePriceIdAdditionalChild: varchar('stripe_price_id_additional_child', { length: 255 }),

  // Features list
  features: jsonb('features').default(sql`'[]'::jsonb`),

  // Status
  isActive: boolean('is_active').notNull().default(true),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Table user_subscriptions - Abonnement individuel par enfant
 *
 * Chaque enfant a son propre enregistrement avec:
 * - Plan associé (free ou premium)
 * - Compteur de tokens journalier
 * - Date de dernier reset
 */
export const userSubscriptions = pgTable('user_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().unique(), // L'enfant
  planId: uuid('plan_id').notNull(),
  status: subscriptionStatusEnum('status').notNull().default('active'),

  // ===== ROLLING WINDOW 5H (nouveau système) =====
  // Tokens utilisés dans la fenêtre actuelle de 5h
  windowTokensUsed: integer('window_tokens_used').notNull().default(0),
  // Début de la fenêtre actuelle
  windowStartAt: timestamp('window_start_at', { withTimezone: true }).notNull().defaultNow(),

  // ===== DAILY CAP (sécurité anti-abus) =====
  // Reset quotidien à 10h Paris - limite max journalière
  tokensUsedToday: integer('tokens_used_today').notNull().default(0),
  decksGeneratedToday: integer('decks_generated_today').notNull().default(0),
  lastResetAt: timestamp('last_reset_at', { withTimezone: true }).notNull().defaultNow(),

  // Monthly usage tracking (reset le 1er du mois)
  decksGeneratedThisMonth: integer('decks_generated_this_month').notNull().default(0),
  lastMonthlyResetAt: timestamp('last_monthly_reset_at', { withTimezone: true }).notNull().defaultNow(),

  // ===== WEEKLY STATS (pour dashboard parent) =====
  tokensUsedThisWeek: integer('tokens_used_this_week').notNull().default(0),
  lastWeeklyResetAt: timestamp('last_weekly_reset_at', { withTimezone: true }).notNull().defaultNow(),

  // Usage statistics (lifetime)
  totalTokensUsed: integer('total_tokens_used').notNull().default(0),
  totalMessagesCount: integer('total_messages_count').notNull().default(0),
  totalDaysActive: integer('total_days_active').notNull().default(0),

  // Subscription lifecycle
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

  // Metadata
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'user_subscriptions_user_id_fkey'
  }).onDelete('cascade'),

  planIdFk: foreignKey({
    columns: [table.planId],
    foreignColumns: [subscriptionPlans.id],
    name: 'user_subscriptions_plan_id_fkey'
  }).onDelete('restrict'),

  statusIdx: index('idx_user_subscriptions_status').on(table.status),
  lastResetIdx: index('idx_user_subscriptions_last_reset').on(table.lastResetAt),
}));

/**
 * Table family_billing - Facturation centralisée par parent
 *
 * Le parent gère la facturation Stripe pour tous ses enfants:
 * - Un seul abonnement Stripe par famille
 * - Calcul automatique: 15€ premier enfant + 5€ par enfant supplémentaire
 * - Prorata lors d'ajout/suppression d'enfants
 */
export const familyBilling = pgTable('family_billing', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentId: varchar('parent_id', { length: 255 }).notNull().unique(), // Le parent payeur

  // Stripe integration
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).unique(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).unique(),
  billingStatus: varchar('billing_status', { length: 50 }).notNull().default('active'), // active, past_due, canceled

  // Billing period
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),

  // Amounts
  monthlyAmountCents: integer('monthly_amount_cents').notNull().default(0),
  lastPaymentAmountCents: integer('last_payment_amount_cents'),
  lastPaymentAt: timestamp('last_payment_at', { withTimezone: true }),

  // Children tracking
  premiumChildrenCount: integer('premium_children_count').notNull().default(0),

  // Stripe metadata for reconciliation
  stripeMetadata: jsonb('stripe_metadata').default(sql`'{}'::jsonb`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  parentIdFk: foreignKey({
    columns: [table.parentId],
    foreignColumns: [user.id],
    name: 'family_billing_parent_id_fkey'
  }).onDelete('cascade'),

  stripeCustomerIdx: index('idx_family_billing_stripe_customer').on(table.stripeCustomerId),
  stripeSubscriptionIdx: index('idx_family_billing_stripe_subscription').on(table.stripeSubscriptionId),
  billingStatusIdx: index('idx_family_billing_status').on(table.billingStatus),
}));

// Subscription Relations
export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  userSubscriptions: many(userSubscriptions),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(user, {
    fields: [userSubscriptions.userId],
    references: [user.id]
  }),
  plan: one(subscriptionPlans, {
    fields: [userSubscriptions.planId],
    references: [subscriptionPlans.id]
  }),
}));

export const familyBillingRelations = relations(familyBilling, ({ one }) => ({
  parent: one(user, {
    fields: [familyBilling.parentId],
    references: [user.id]
  }),
}));

// =============================================
// TYPES TYPESCRIPT
// =============================================
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type StudySession = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Progress = typeof progress.$inferSelect;
export type NewProgress = typeof progress.$inferInsert;

// Type pour fichier attaché aux messages
export interface AttachedFile {
  fileName: string;
  fileId?: string;
  geminiFileId?: string;
  mimeType?: string;
  fileSizeBytes?: number;
}

// Types pour Establishments
export type Establishment = typeof establishments.$inferSelect;
export type NewEstablishment = typeof establishments.$inferInsert;

// Types avec relations
export type UserWithRelations = User & {
  parent?: User | null;
  children?: User[];
  sessions?: Session[];
  accounts?: Account[];
  studySessions?: StudySession[];
  progress?: Progress[];
};

// Types de recherche d'établissements
export type EstablishmentSearchResult = {
  rne: string;
  name: string;
  type: EstablishmentType;
  address: string;
  city: string;
  postalCode: string;
  department: string;
  academy: string;
  pronoteUrl: string;
  status: EstablishmentStatus;
  distance?: number; // Pour recherche géographique
  relevance?: number; // Score de pertinence Full-Text Search
  searchMethod?: 'fts' | 'fuzzy' | 'geo'; // Méthode de recherche utilisée
};

// Enum types
export type UserRole = typeof userRoleEnum.enumValues[number];
export type SchoolLevel = typeof schoolLevelEnum.enumValues[number];
export type SessionStatus = typeof sessionStatusEnum.enumValues[number];
export type MessageRole = typeof messageRoleEnum.enumValues[number];

// AI Model: string type (pas d'ENUM = flexibilité pour nouveaux modèles)
export type AIModel = string;

// Enum types pour Establishments
export type EstablishmentType = typeof establishmentTypeEnum.enumValues[number];
export type EstablishmentStatus = typeof establishmentStatusEnum.enumValues[number];

// Pronote Integration Types
export type PronoteConnectionStatus = typeof pronoteConnectionStatusEnum.enumValues[number];
export type PronoteConnection = typeof pronoteConnections.$inferSelect;
export type NewPronoteConnection = typeof pronoteConnections.$inferInsert;
export type PronoteChildMapping = typeof pronoteChildMappings.$inferSelect;
export type NewPronoteChildMapping = typeof pronoteChildMappings.$inferInsert;

// Pronote resource from parent account (stored in pronoteResources JSONB)
export interface PronoteResource {
  name: string;
  id: string;
  className?: string;
}

export type PronoteConnectionWithRelations = PronoteConnection & {
  parent?: User;
  establishment?: Establishment;
  childMappings?: PronoteChildMapping[];
};

export type PronoteChildMappingWithRelations = PronoteChildMapping & {
  connection?: PronoteConnection;
  child?: User;
};

// =============================================
// LEARNING TOOLS SYSTEM (Flashcards, QCM, Vrai/Faux)
// =============================================

/**
 * ARCHITECTURE OUTILS DE RÉVISION - Design Minimaliste 2025
 *
 * 🎯 Philosophie:
 * - Outils simples de révision, PAS de gamification
 * - Pas de progression visible, pas de stats anxiogènes
 * - FSRS (Free Spaced Repetition Scheduler) en background invisible
 *
 * 📚 Types de cartes:
 * - Flashcard: recto/verso classique
 * - QCM: question à choix multiples
 * - Vrai/Faux: affirmation à valider
 *
 * 🔗 Sources de création:
 * - prompt: création libre par l'utilisateur
 * - conversation: extraction depuis session de chat
 * - document: extraction depuis PDF/image uploadé
 * - rag_program: génération depuis programme officiel
 */

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

/**
 * Learning Decks - Collections de cartes de révision
 *
 * Un "deck" est une collection thématique de cartes.
 * Organisé par matière et adapté au niveau scolaire pour validation RAG.
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

  // Contexte éducatif (pour validation RAG)
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
 *
 * Structure du contenu JSON selon cardType:
 *
 * Flashcard:
 * { front: string, back: string }
 *
 * QCM:
 * { question: string, options: string[], correctIndex: number, explanation?: string }
 *
 * Vrai/Faux:
 * { statement: string, isTrue: boolean, explanation?: string }
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

// Learning Tools Relations
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

// Subscription System Types
export type SubscriptionPlanTypeEnum = typeof subscriptionPlanTypeEnum.enumValues[number];
export type SubscriptionStatusEnum = typeof subscriptionStatusEnum.enumValues[number];

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewUserSubscription = typeof userSubscriptions.$inferInsert;

export type FamilyBilling = typeof familyBilling.$inferSelect;
export type NewFamilyBilling = typeof familyBilling.$inferInsert;

// Subscription Types with Relations
export type UserSubscriptionWithRelations = UserSubscription & {
  user?: User;
  plan?: SubscriptionPlan;
};

export type FamilyBillingWithRelations = FamilyBilling & {
  parent?: User;
};

// Learning Tools System Types
export type CardType = typeof cardTypeEnum.enumValues[number];
export type DeckSource = typeof deckSourceEnum.enumValues[number];

export type LearningDeck = typeof learningDecks.$inferSelect;
export type NewLearningDeck = typeof learningDecks.$inferInsert;

export type LearningCard = typeof learningCards.$inferSelect;
export type NewLearningCard = typeof learningCards.$inferInsert;

// Learning Tools Types with Relations
export type LearningDeckWithRelations = LearningDeck & {
  user?: User;
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
