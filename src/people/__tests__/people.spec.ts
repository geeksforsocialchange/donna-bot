import assert from 'assert/strict'
import { describe, it } from 'node:test'
import { parsePeople } from '../people.js'

describe('people/people.ts parsePeople', () => {
  it('parses valid entries', () => {
    const people = parsePeople(`
- name: Kim
  discord_id: "123456789012345678"
  github: kimadactyl
- name: Sam
  discord_id: "876543210987654321"
  github: sam-example
`);
    assert.equal(people.length, 2);
    assert.deepEqual(people[0], {
      name: 'Kim',
      discordId: '123456789012345678',
      github: 'kimadactyl',
    });
  })

  it('returns empty for an empty or comment-only file', () => {
    assert.deepEqual(parsePeople(''), []);
    assert.deepEqual(parsePeople('# just comments\n'), []);
    assert.deepEqual(parsePeople('[]'), []);
  })

  it('defaults name to the github username', () => {
    const people = parsePeople(`
- discord_id: "123456789012345678"
  github: kimadactyl
`);
    assert.equal(people[0].name, 'kimadactyl');
  })

  it('skips entries with unquoted discord_id (precision loss)', () => {
    const people = parsePeople(`
- name: Oops
  discord_id: 123456789012345678
  github: kimadactyl
`);
    assert.deepEqual(people, []);
  })

  it('skips entries with invalid github usernames', () => {
    const people = parsePeople(`
- name: Sneaky
  discord_id: "123456789012345678"
  github: "x org:evil"
`);
    assert.deepEqual(people, []);
  })

  it('ignores a non-list file', () => {
    assert.deepEqual(parsePeople('just a string'), []);
  })
})
