import assert from 'assert/strict'
import { describe, it } from 'node:test'
import { initLinksDatabase, setGithubLink, getGithubLink } from '../links.js'
import { randomUUID } from 'crypto'

describe('db/links.ts', () => {
  it('initialises a database', () => {
    initLinksDatabase();
  })
  it('returns null for an unlinked user', () => {
    assert.equal(getGithubLink(randomUUID()), null);
  })
  it('stores and retrieves a link', () => {
    const discordId = randomUUID();
    setGithubLink(discordId, 'octocat');
    assert.equal(getGithubLink(discordId), 'octocat');
  })
  it('overwrites an existing link', () => {
    const discordId = randomUUID();
    setGithubLink(discordId, 'octocat');
    setGithubLink(discordId, 'monalisa');
    assert.equal(getGithubLink(discordId), 'monalisa');
  })
})
