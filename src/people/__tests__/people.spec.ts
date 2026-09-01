import assert from 'assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'fs'
import { parse as yamlParse } from 'yaml'
import { parsePeople } from '../people.js'

describe('people/people.ts parsePeople', () => {
  it('parses valid entries', () => {
    const people = parsePeople(`
- name: Kim
  discord: kimadactyl
  github: kimadactyl
- name: Sam
  discord: sam.discord
  github: sam-example
`);
    assert.equal(people.length, 2);
    assert.deepEqual(people[0], {
      name: 'Kim',
      discord: 'kimadactyl',
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
- discord: kimadactyl
  github: kimadactyl
`);
    assert.equal(people[0].name, 'kimadactyl');
  })

  it('skips entries with a missing discord username', () => {
    const people = parsePeople(`
- name: Oops
  github: kimadactyl
`);
    assert.deepEqual(people, []);
  })

  it('skips entries with invalid github usernames', () => {
    const people = parsePeople(`
- name: Sneaky
  discord: sneaky
  github: "x org:evil"
`);
    assert.deepEqual(people, []);
  })

  it('ignores a non-list file', () => {
    assert.deepEqual(parsePeople('just a string'), []);
  })

  it('returns empty rather than throwing on malformed YAML', () => {
    assert.deepEqual(parsePeople('- name: "unclosed'), []);
    assert.deepEqual(parsePeople('\t- tabs are not yaml'), []);
  })
})

describe('config/people.yml (the real file)', () => {
  it('parses with no entries skipped', () => {
    const content = readFileSync('./config/people.yml', 'utf-8');
    const raw = yamlParse(content) as unknown[];
    const people = parsePeople(content);
    assert.ok(people.length > 0, 'expected at least one person');
    assert.equal(
      people.length,
      raw.length,
      'an entry in config/people.yml failed validation and would be silently ignored by the bot',
    );
  })
})
