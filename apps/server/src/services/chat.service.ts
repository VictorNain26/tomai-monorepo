/**
 * Chat Service - Re-export facade for backward compatibility
 * Implementation split into chat-session.service.ts and chat-message.service.ts
 */

import { ChatSessionService } from './chat/chat-session.service';
import { ChatMessageService } from './chat/chat-message.service';
import type { Message as DbMessage, SchoolLevel } from '../db/schema';
import type { SessionDetails, MessageDetails, UserSession, ConversationListItem } from './chat/chat-types';

// Re-export types
export type { SessionDetails, MessageDetails, ProgressUpdate, UserSession, ConversationListItem } from './chat/chat-types';

export class ChatService {
  private readonly sessions = new ChatSessionService();
  private readonly messages = new ChatMessageService();

  async getOrCreateActiveSession(userId: string): Promise<string> {
    return this.sessions.getOrCreateActiveSession(userId);
  }

  async createSession(userId: string, subject: string, topic?: string): Promise<string> {
    return this.sessions.createSession(userId, subject, topic);
  }

  async updateSessionWithFiles(sessionId: string, fileData: {
    fileName: string;
    analysis: string;
    extractedText?: string;
    fileType: string;
    size: number;
    uploadedAt: string;
  }): Promise<void> {
    return this.sessions.updateSessionWithFiles(sessionId, fileData);
  }

  async getSessionFiles(sessionId: string): Promise<Array<{
    fileName: string;
    analysis: string;
    extractedText?: string;
    fileType: string;
    analyzedAt: string;
  }>> {
    return this.sessions.getSessionFiles(sessionId);
  }

  async getSession(sessionId: string): Promise<SessionDetails | null> {
    return this.sessions.getSession(sessionId);
  }

  async getSessionWithSummary(sessionId: string): Promise<{
    conversationSummary: string | null;
    summaryUpToMessageId: string | null;
  } | null> {
    return this.sessions.getSessionWithSummary(sessionId);
  }

  async getSessionHistory(sessionId: string, options?: { limit?: number; afterMessageId?: string }): Promise<DbMessage[]> {
    return this.messages.getSessionHistory(sessionId, options);
  }

  async getUserSessions(userId: string, limit?: number): Promise<UserSession[]> {
    return this.sessions.getUserSessions(userId, limit);
  }

  async saveMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata: {
      frustrationLevel?: number | null;
      questionLevel?: number | null;
      tokensUsed?: number | null;
      responseTimeMs?: number | null;
      aiModel?: string | null;
      attachedFile?: {
        fileName: string;
        fileId?: string;
        geminiFileId?: string;
        mimeType?: string;
        fileSizeBytes?: number;
      };
    },
    options?: { verifySessionExists?: boolean }
  ): Promise<{ messageId: string; realSessionId: string }> {
    return this.messages.saveMessage(sessionId, role, content, metadata, options);
  }

  async deleteSession(sessionId: string, userId?: string): Promise<void> {
    return this.sessions.deleteSession(sessionId, userId);
  }

  async resetSession(sessionId: string, userId: string): Promise<string> {
    return this.sessions.resetSession(sessionId, userId);
  }

  async getMessageById(messageId: string, userId: string): Promise<MessageDetails | null> {
    return this.messages.getMessageById(messageId, userId);
  }

  async getUserById(userId: string): Promise<{ id: string; schoolLevel: SchoolLevel; firstName?: string } | null> {
    return this.sessions.getUserById(userId);
  }

  async listConversations(userId: string, options?: { limit?: number; offset?: number }): Promise<ConversationListItem[]> {
    return this.sessions.listConversations(userId, options);
  }
}

// Export singleton instance
export const chatService = new ChatService();
