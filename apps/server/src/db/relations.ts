import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

export const relations = defineRelations(schema, (r) => ({
  // =============================================
  // AUTH DOMAIN
  // =============================================
  user: {
    parent: r.one.user({
      from: r.user.parentId,
      to: r.user.id,
      alias: 'parent_child',
    }),
    children: r.many.user({
      from: r.user.id,
      to: r.user.parentId,
      alias: 'parent_child',
    }),
    sessions: r.many.session(),
    accounts: r.many.account(),
    studySessions: r.many.studySessions(),
    progress: r.many.progress(),
    costTracking: r.many.costTracking(),
    files: r.many.files(),
    learningDecks: r.many.learningDecks(),
    pronoteConnection: r.one.pronoteConnections({
      from: r.user.id,
      to: r.pronoteConnections.parentId,
    }),
    pronoteChildMappings: r.many.pronoteChildMappings(),
    cognitiveProfile: r.one.studentCognitiveProfiles({
      from: r.user.id,
      to: r.studentCognitiveProfiles.userId,
    }),
  },

  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),
  },

  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },

  // =============================================
  // LEARNING DOMAIN
  // =============================================
  studySessions: {
    user: r.one.user({
      from: r.studySessions.userId,
      to: r.user.id,
    }),
    messages: r.many.messages(),
    costTracking: r.many.costTracking(),
    sessionFiles: r.many.sessionFiles(),
  },

  messages: {
    session: r.one.studySessions({
      from: r.messages.sessionId,
      to: r.studySessions.id,
    }),
  },

  progress: {
    user: r.one.user({
      from: r.progress.userId,
      to: r.user.id,
    }),
  },

  costTracking: {
    user: r.one.user({
      from: r.costTracking.userId,
      to: r.user.id,
    }),
    session: r.one.studySessions({
      from: r.costTracking.sessionId,
      to: r.studySessions.id,
    }),
  },

  // =============================================
  // LEARNING TOOLS DOMAIN
  // =============================================
  learningDecks: {
    user: r.one.user({
      from: r.learningDecks.userId,
      to: r.user.id,
    }),
    cards: r.many.learningCards(),
  },

  learningCards: {
    deck: r.one.learningDecks({
      from: r.learningCards.deckId,
      to: r.learningDecks.id,
    }),
  },

  studentCognitiveProfiles: {
    user: r.one.user({
      from: r.studentCognitiveProfiles.userId,
      to: r.user.id,
    }),
  },

  // =============================================
  // PRONOTE DOMAIN
  // =============================================
  pronoteConnections: {
    parent: r.one.user({
      from: r.pronoteConnections.parentId,
      to: r.user.id,
    }),
    childMappings: r.many.pronoteChildMappings(),
  },

  pronoteChildMappings: {
    connection: r.one.pronoteConnections({
      from: r.pronoteChildMappings.connectionId,
      to: r.pronoteConnections.id,
    }),
    child: r.one.user({
      from: r.pronoteChildMappings.childId,
      to: r.user.id,
    }),
  },

  // =============================================
  // FILES DOMAIN
  // =============================================
  files: {
    user: r.one.user({
      from: r.files.userId,
      to: r.user.id,
    }),
    sessionFiles: r.many.sessionFiles(),
  },

  sessionFiles: {
    session: r.one.studySessions({
      from: r.sessionFiles.sessionId,
      to: r.studySessions.id,
    }),
    file: r.one.files({
      from: r.sessionFiles.fileId,
      to: r.files.id,
    }),
  },

  // =============================================
  // BILLING DOMAIN
  // =============================================
  subscriptionPlans: {
    userSubscriptions: r.many.userSubscriptions(),
  },

  userSubscriptions: {
    user: r.one.user({
      from: r.userSubscriptions.userId,
      to: r.user.id,
    }),
    plan: r.one.subscriptionPlans({
      from: r.userSubscriptions.planId,
      to: r.subscriptionPlans.id,
    }),
  },

  familyBilling: {
    parent: r.one.user({
      from: r.familyBilling.parentId,
      to: r.user.id,
    }),
  },

  // =============================================
  // NOTIFICATIONS DOMAIN
  // =============================================
  devicePushTokens: {
    user: r.one.user({
      from: r.devicePushTokens.userId,
      to: r.user.id,
    }),
  },
}));
