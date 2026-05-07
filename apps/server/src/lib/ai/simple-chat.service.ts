/**
 * Simple Chat Service — Mistral Small 4 non-streaming
 *
 * Provides a simple interface for generating single responses without
 * streaming. Used for test routes and simple generation tasks.
 */

import { getMistralClient } from '../mistral-client.js';
import { appConfig } from '../../config/app.config.js';
import { buildSystemPrompt } from '../../config/prompts/index.js';
import { getLevelText } from '../../config/education/index.js';
import type { EducationLevelType } from '../../types/index.js';

export interface SimpleChatParams {
  level: EducationLevelType;
  subject: string;
  userQuery: string;
  educationalContext?: string;
}

export interface SimpleChatResult {
  content: string;
  provider: string;
  tokensUsed: number;
}

export async function generateSimpleResponse(
  params: SimpleChatParams,
): Promise<SimpleChatResult> {
  const provider = '@mistralai/mistralai';
  const levelText = getLevelText(params.level);

  const systemPrompt = buildSystemPrompt({
    level: params.level,
    levelText,
    subject: params.subject,
  });

  const userContent = params.educationalContext
    ? `<context source="curriculum">\n${params.educationalContext}\n</context>\n\n${params.userQuery}`
    : params.userQuery;

  const client = getMistralClient();
  const model = appConfig.ai.mistral?.chatModel ?? 'mistral-small-latest';

  const response = await client.chat.complete({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: appConfig.ai.mistral?.temperature ?? 0.7,
    maxTokens: appConfig.ai.mistral?.maxTokens ?? 4096,
  });

  const raw = response.choices?.[0]?.message?.content;
  const text = typeof raw === 'string' ? raw : '';
  const tokensUsed = response.usage?.totalTokens ?? 0;

  return {
    content: text,
    provider,
    tokensUsed,
  };
}
