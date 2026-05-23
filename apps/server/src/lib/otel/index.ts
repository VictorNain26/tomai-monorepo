export { setupOtel, shutdownOtel } from './otel.js';
export {
  withGenAiSpan,
  withDbSpan,
  type GenAiOperation,
  type GenAiSpanInput,
  type GenAiResponseFacts,
  type DbSpanInput,
} from './spans.js';
