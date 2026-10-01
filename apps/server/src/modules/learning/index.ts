import { learningCardsRepository } from './learning-cards.repository.js';

export { learningRoutes } from './learning.routes.js';
export { learningService } from './learning.service.js';
export { generateCards, type CardGenerationResult } from './card-generator.service.js';
export { getLevelConfig } from './learning-config.js';

export const getReviewSignals = (userId: string) => learningCardsRepository.getReviewSignals(userId);
