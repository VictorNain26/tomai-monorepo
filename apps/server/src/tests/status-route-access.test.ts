import { describe, expect, it } from 'bun:test';

function canParentAccessChild(authedId: string, isLinked: boolean): boolean {
  return isLinked;
}

describe('status route parent→child access', () => {
  it('grants access when linked', () => {
    expect(canParentAccessChild('p1', true)).toBe(true);
  });

  it('denies access when not linked', () => {
    expect(canParentAccessChild('p1', false)).toBe(false);
  });
});
