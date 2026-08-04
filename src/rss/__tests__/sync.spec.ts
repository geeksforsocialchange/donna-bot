import assert from 'assert/strict'
import { describe, it } from 'node:test'
import { computeBackoffMs } from '../sync.js'

describe('rss/sync.ts computeBackoffMs', () => {
  const MINUTE = 60 * 1000;

  it('retries on the next poll after the first failure', () => {
    assert.equal(computeBackoffMs(1, 5), 5 * MINUTE);
  })
  it('doubles with each consecutive failure', () => {
    assert.equal(computeBackoffMs(2, 5), 10 * MINUTE);
    assert.equal(computeBackoffMs(3, 5), 20 * MINUTE);
    assert.equal(computeBackoffMs(5, 5), 80 * MINUTE);
  })
  it('caps at 6 hours', () => {
    assert.equal(computeBackoffMs(10, 5), 360 * MINUTE);
    assert.equal(computeBackoffMs(100, 5), 360 * MINUTE);
  })
})
