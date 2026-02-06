import { describe, it, expect } from 'vitest';

describe('Backend Sanity Check', () => {
  it('should pass a basic math test', () => {
    expect(1 + 1).toBe(2);
  });
});