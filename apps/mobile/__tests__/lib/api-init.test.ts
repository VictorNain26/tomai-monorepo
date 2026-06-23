/**
 * api-init test - TDD verification
 * Tests that initializeAppApi() consumes resolveApiUrl() and passes the resolved URL
 * to initializeApi()
 */

jest.mock('@/lib/auth', () => ({
  authClient: {
    getCookie: jest.fn(() => undefined),
  },
}));

jest.mock('@/lib/api-url', () => ({
  resolveApiUrl: jest.fn(() => 'http://192.168.1.42:3000'),
}));

import * as apiModule from '@repo/api';
import { initializeAppApi } from '@/lib/api';

describe('api-init', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('initializes API with resolved URL from resolveApiUrl', () => {
    const mockInitializeApi = jest.spyOn(apiModule, 'initializeApi');

    initializeAppApi();

    expect(mockInitializeApi).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'http://192.168.1.42:3000',
      }),
    );

    mockInitializeApi.mockRestore();
  });
});
