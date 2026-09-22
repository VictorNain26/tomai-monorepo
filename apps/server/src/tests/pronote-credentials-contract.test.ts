import { describe, it, expect } from 'bun:test';
import type { App } from '../app';

type PronoteCredentialRoutes = App['~Routes']['api']['pronote']['credentials'];
type DeviceFirstRoutes = Extract<keyof PronoteCredentialRoutes, 'get' | 'put' | 'delete'>;

const deviceFirstRoutesRemoved: [DeviceFirstRoutes] extends [never] ? true : false = true;

describe('Eden contract — Pronote credentials', () => {
  // The real check is the type-level one above (tsc fails to compile if the routes
  // come back); this assertion only documents the intent at runtime.
  it('no longer exposes the device-first GET/PUT/DELETE /api/pronote/credentials', () => {
    expect(deviceFirstRoutesRemoved).toBe(true);
  });
});
