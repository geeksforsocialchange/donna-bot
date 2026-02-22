import assert from 'assert/strict'
import { describe, it } from 'node:test'
import { loadFeedUrls } from '../feeds.js'

describe('rss/feeds.ts', () => {
  it('loadFeedUrls', () => {
    const feeds = loadFeedUrls();
    for (const feed of feeds) {
      assert.ok(feed.startsWith("http://") || feed.startsWith("https://"))
    }

  })
})
