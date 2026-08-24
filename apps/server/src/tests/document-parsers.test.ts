import { describe, it, expect } from 'bun:test';
import {
  parseAnalysisResponse,
  parseImageAnalysisResponse,
  createErrorResult,
} from '../services/document/document-parsers.js';

describe('parseAnalysisResponse', () => {
  it('parses valid JSON inside markdown code fences', () => {
    const response = '```json\n{"classification":{"documentType":"exercice","subject":"mathematiques","confidence":"high"},"analysis":"Exercice de géométrie."}\n```';
    const result = parseAnalysisResponse(response);

    expect(result.classification.documentType).toBe('exercice');
    expect(result.classification.subject).toBe('mathematiques');
    expect(result.classification.confidence).toBe('high');
    expect(result.analysis).toBe('Exercice de géométrie.');
  });

  it('parses valid JSON inside code fences without json tag', () => {
    const response = '```\n{"classification":{"documentType":"cours","subject":"francais","confidence":"medium"},"analysis":"Cours de grammaire."}\n```';
    const result = parseAnalysisResponse(response);

    expect(result.classification.documentType).toBe('cours');
    expect(result.classification.subject).toBe('francais');
    expect(result.analysis).toBe('Cours de grammaire.');
  });

  it('parses valid raw JSON without code fences', () => {
    const response = '{"classification":{"documentType":"devoir","subject":"anglais","confidence":"low"},"analysis":"Homework assignment."}';
    const result = parseAnalysisResponse(response);

    expect(result.classification.documentType).toBe('devoir');
    expect(result.classification.subject).toBe('anglais');
    expect(result.analysis).toBe('Homework assignment.');
  });

  it('returns safe fallback on malformed JSON', () => {
    const response = 'This is not JSON at all {{{broken';
    const result = parseAnalysisResponse(response);

    expect(result.classification.documentType).toBe('document');
    expect(result.classification.subject).toBe('inconnu');
    expect(result.classification.confidence).toBe('low');
    expect(result.analysis).toBe(response);
  });

  it('returns safe fallback when classification key is missing', () => {
    const response = '{"analysis":"Some analysis text"}';
    const result = parseAnalysisResponse(response);

    expect(result.classification.documentType).toBe('document');
    expect(result.classification.subject).toBe('inconnu');
    expect(result.classification.confidence).toBe('low');
    expect(result.analysis).toBe('Some analysis text');
  });

  it('returns safe fallback when classification has invalid enum values', () => {
    const response = '{"classification":{"documentType":"invalid","subject":"unknown","confidence":"very-high"},"analysis":"Test"}';
    const result = parseAnalysisResponse(response);

    expect(result.classification.documentType).toBe('document');
    expect(result.classification.subject).toBe('inconnu');
    expect(result.classification.confidence).toBe('low');
    expect(result.analysis).toBe(response);
  });

  it('defaults analysis to fallback text when missing', () => {
    const response = '{"classification":{"documentType":"exercice","subject":"svt","confidence":"medium"}}';
    const result = parseAnalysisResponse(response);

    expect(result.classification.documentType).toBe('exercice');
    expect(result.analysis).toBe('Analyse non disponible.');
  });
});

describe('parseImageAnalysisResponse', () => {
  it('parses valid response with extractedText', () => {
    const response = '```json\n{"classification":{"documentType":"exercice","subject":"physique-chimie","confidence":"high"},"analysis":"Exercice de mécanique.","extractedText":"F = ma"}\n```';
    const result = parseImageAnalysisResponse(response);

    expect(result.classification.documentType).toBe('exercice');
    expect(result.analysis).toBe('Exercice de mécanique.');
    expect(result.extractedText).toBe('F = ma');
  });

  it('defaults extractedText to empty string when missing', () => {
    const response = '{"classification":{"documentType":"cours","subject":"histoire","confidence":"medium"},"analysis":"Leçon."}';
    const result = parseImageAnalysisResponse(response);

    expect(result.extractedText).toBe('');
  });

  it('returns safe fallback with empty extractedText on malformed JSON', () => {
    const response = 'not valid json';
    const result = parseImageAnalysisResponse(response);

    expect(result.classification.documentType).toBe('document');
    expect(result.classification.subject).toBe('inconnu');
    expect(result.extractedText).toBe('');
    expect(result.analysis).toBe(response);
  });
});

describe('createErrorResult', () => {
  it('returns a correctly shaped error result', () => {
    const startTime = Date.now() - 500;
    const result = createErrorResult(startTime, 200, 'Upload failed');

    expect(result.success).toBe(false);
    expect(result.extraction.text).toBe('');
    expect(result.extraction.method).toBe('none');
    expect(result.extraction.wordCount).toBe(0);
    expect(result.classification.documentType).toBe('non-educatif');
    expect(result.classification.subject).toBe('inconnu');
    expect(result.classification.confidence).toBe('low');
    expect(result.analysis).toBe('');
    expect(result.metrics.extractionTimeMs).toBe(200);
    expect(result.metrics.analysisTimeMs).toBe(0);
    expect(result.metrics.totalTimeMs).toBeGreaterThanOrEqual(400);
    expect(result.error).toBe('Upload failed');
  });
});
