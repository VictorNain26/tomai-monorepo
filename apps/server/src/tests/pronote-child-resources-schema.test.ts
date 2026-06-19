import { describe, expect, it } from 'bun:test';
import { pronoteChildResources } from '../db/schema/pronote.schema';

describe('pronote_child_resources schema', () => {
  it('exposes the mapping columns', () => {
    const cols = Object.keys(pronoteChildResources);
    expect(cols).toEqual(expect.arrayContaining([
      'id', 'parentUserId', 'childUserId', 'resourceId', 'createdAt', 'updatedAt',
    ]));
  });
});
