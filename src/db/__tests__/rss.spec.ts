import assert from 'assert/strict'
import { describe, it } from 'node:test'
import { initRssDatabase, isEntryPosted, markEntryPosted } from '../rss.js'
import { randomUUID } from 'crypto'

describe('db/rss.ts', () => {
  it('initialises a database', () => {
    initRssDatabase();
  })
  it('returns empty for an empty database', () => {
    const guid = randomUUID();
    const res = isEntryPosted('https://example.com', guid);
    assert.equal(res, false);
  })
  it('returns true for an existing feed entry', () => {
    const guid = randomUUID();
    markEntryPosted('https://example.com', guid, 'test entry');
    assert.ok(isEntryPosted('https://example.com', guid))
  })
})
