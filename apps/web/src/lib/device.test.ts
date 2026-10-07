import { describe, expect, it } from 'bun:test';
import { deviceName } from './device';

describe('deviceName', () => {
  it('names a phone by its system and browser', () => {
    expect(
      deviceName(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('iOS · Safari');
    expect(deviceName('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36')).toBe(
      'Android · Chrome',
    );
  });

  it('says so for a user agent it cannot read, or none', () => {
    expect(deviceName('test-device')).toBe('Appareil inconnu');
    expect(deviceName(null)).toBe('Appareil inconnu');
    expect(deviceName('')).toBe('Appareil inconnu');
  });
});
