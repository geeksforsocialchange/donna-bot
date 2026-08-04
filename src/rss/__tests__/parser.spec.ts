import assert from 'assert/strict'
import { describe, it } from 'node:test'
import { extractImageUrl } from '../parser.js'

// extractImageUrl takes a loose rss-parser item; cast the fixtures to match.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const item = (fields: Record<string, unknown>) => fields as any

describe('rss/parser.ts extractImageUrl', () => {
  it('prefers an image enclosure', () => {
    assert.equal(
      extractImageUrl(item({ enclosure: { url: 'https://x.test/a.jpg', type: 'image/jpeg' } })),
      'https://x.test/a.jpg'
    )
  })

  it('ignores a non-image enclosure', () => {
    assert.equal(
      extractImageUrl(item({ enclosure: { url: 'https://x.test/a.mp3', type: 'audio/mpeg' } })),
      null
    )
  })

  it('reads media:content with medium=image', () => {
    assert.equal(
      extractImageUrl(item({ mediaContent: [{ $: { url: 'https://x.test/b.png', medium: 'image' } }] })),
      'https://x.test/b.png'
    )
  })

  it('reads a single (non-array) media:content node', () => {
    assert.equal(
      extractImageUrl(item({ mediaContent: { $: { url: 'https://x.test/c.jpg', type: 'image/jpeg' } } })),
      'https://x.test/c.jpg'
    )
  })

  it('reads media:content by url extension when medium/type absent', () => {
    assert.equal(
      extractImageUrl(item({ mediaContent: [{ $: { url: 'https://x.test/d.webp' } }] })),
      'https://x.test/d.webp'
    )
  })

  it('falls back to media:thumbnail', () => {
    assert.equal(
      extractImageUrl(item({ mediaThumbnail: [{ $: { url: 'https://x.test/t.jpg' } }] })),
      'https://x.test/t.jpg'
    )
  })

  it('falls back to the first <img> in content', () => {
    assert.equal(
      extractImageUrl(item({ content: '<p>hi</p><img src="https://x.test/e.png" alt="x">' })),
      'https://x.test/e.png'
    )
  })

  it('rejects a relative <img> src', () => {
    assert.equal(
      extractImageUrl(item({ content: '<img src="/images/rel.png">' })),
      null
    )
  })

  it('returns null when there is no image', () => {
    assert.equal(
      extractImageUrl(item({ content: '<p>no pictures here</p>' })),
      null
    )
  })
})
