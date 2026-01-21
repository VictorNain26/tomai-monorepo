/**
 * Mock for @repo/api package
 */

export const apiClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

export const getBaseUrl = jest.fn(() => 'http://localhost:3000');

export const initializeApi = jest.fn();

export const setUnauthorizedHandler = jest.fn();
