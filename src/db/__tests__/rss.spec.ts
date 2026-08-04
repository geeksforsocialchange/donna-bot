import assert from 'assert/strict'
import { describe, it } from 'node:test'
import {
  getFeedHealth,
  initRssDatabase,
  isEntryPosted,
  markEntryPosted,
  markFeedNotified,
  recordFeedFailure,
  recordFeedSuccess,
} from '../rss.js'
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

describe('db/rss.ts feed health', () => {
  it('has no health row for an unknown feed', () => {
    initRssDatabase();
    assert.equal(getFeedHealth(`https://${randomUUID()}.example.com`), null);
  })
  it('counts consecutive failures', () => {
    const url = `https://${randomUUID()}.example.com/feed.xml`;
    assert.equal(recordFeedFailure(url, 'ETIMEDOUT', 1000), 1);
    assert.equal(recordFeedFailure(url, 'ETIMEDOUT', 2000), 2);
    const health = getFeedHealth(url);
    assert.equal(health?.consecutive_failures, 2);
    assert.equal(health?.last_error, 'ETIMEDOUT');
    assert.equal(health?.next_retry_at, 2000);
  })
  it('resets on success, including the notified flag', () => {
    const url = `https://${randomUUID()}.example.com/feed.xml`;
    recordFeedFailure(url, 'boom', 1000);
    markFeedNotified(url);
    assert.equal(getFeedHealth(url)?.notified, 1);
    recordFeedSuccess(url);
    const health = getFeedHealth(url);
    assert.equal(health?.consecutive_failures, 0);
    assert.equal(health?.last_error, null);
    assert.equal(health?.next_retry_at, null);
    assert.equal(health?.notified, 0);
  })
})
