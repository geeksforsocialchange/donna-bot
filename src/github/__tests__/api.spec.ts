import assert from 'assert/strict'
import { describe, it } from 'node:test'
import { formatIssueLines, isValidGithubUsername, GithubIssue } from '../api.js'

describe('github/api.ts isValidGithubUsername', () => {
  it('accepts normal usernames', () => {
    assert.ok(isValidGithubUsername('octocat'));
    assert.ok(isValidGithubUsername('kimadactyl'));
    assert.ok(isValidGithubUsername('a-b-c'));
    assert.ok(isValidGithubUsername('user123'));
  })
  it('rejects invalid usernames', () => {
    assert.equal(isValidGithubUsername(''), false);
    assert.equal(isValidGithubUsername('-leading'), false);
    assert.equal(isValidGithubUsername('trailing-'), false);
    assert.equal(isValidGithubUsername('double--hyphen'), false);
    assert.equal(isValidGithubUsername('has space'), false);
    assert.equal(isValidGithubUsername('a'.repeat(40)), false);
    // Query injection attempts must not validate
    assert.equal(isValidGithubUsername('x org:evil'), false);
  })
})

describe('github/api.ts formatIssueLines', () => {
  const issue = (over: Partial<GithubIssue>): GithubIssue => ({
    title: 'A bug',
    htmlUrl: 'https://github.com/org/repo/issues/1',
    repoName: 'repo',
    number: 1,
    isAssigned: false,
    ...over,
  })

  it('groups by repo and sorts by issue number', () => {
    const lines = formatIssueLines([
      issue({ repoName: 'zeta', number: 9, title: 'z issue' }),
      issue({ repoName: 'alpha', number: 3, title: 'later' }),
      issue({ repoName: 'alpha', number: 1, title: 'first' }),
    ]);
    assert.equal(lines[0], '**alpha**');
    assert.match(lines[1], /#1 first/);
    assert.match(lines[2], /#3 later/);
    assert.equal(lines[3], '**zeta**');
    assert.match(lines[4], /#9 z issue/);
  })

  it('marks assigned issues', () => {
    const lines = formatIssueLines([issue({ isAssigned: true })]);
    assert.match(lines[1], /\(assigned\)$/);
  })

  it('wraps URLs in <> to suppress Discord previews', () => {
    const lines = formatIssueLines([issue({})]);
    assert.match(lines[1], /\(<https:\/\/github\.com\/org\/repo\/issues\/1>\)/);
  })
})
