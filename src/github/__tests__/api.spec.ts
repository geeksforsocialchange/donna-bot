import assert from 'assert/strict'
import { describe, it } from 'node:test'
import { formatIssueLines, isValidGithubUsername, joinLinesWithinLimit, GithubIssue } from '../api.js'

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

  it('wraps URLs in <> to suppress Discord previews', () => {
    const lines = formatIssueLines([issue({})]);
    assert.match(lines[1], /\(<https:\/\/github\.com\/org\/repo\/issues\/1>\)/);
  })

  it('sanitizes brackets in titles so they cannot break the link', () => {
    // Discord renders backslash escapes literally inside link labels, so
    // brackets are swapped for parens instead of escaped
    const lines = formatIssueLines([
      issue({ title: 'x](https://evil.example) pwned [y' }),
    ]);
    const label = lines[1].slice(0, lines[1].indexOf('](<'));
    assert.ok(!label.includes(']'), `label still contains ]: ${label}`);
    assert.ok(!label.includes('\\'), `label contains backslashes: ${label}`);
    assert.match(lines[1], /x\)\(https:\/\/evil\.example\) pwned \(y/);
  })

  it('renders a plain [Article] tag as (Article) with no backslashes', () => {
    const lines = formatIssueLines([issue({ title: '[Article] Some piece' })]);
    assert.match(lines[1], /#1 \(Article\) Some piece/);
    assert.ok(!lines[1].includes('\\'));
  })
})

describe('github/api.ts joinLinesWithinLimit', () => {
  it('returns everything when it fits', () => {
    assert.equal(
      joinLinesWithinLimit('**head**', ['a', 'b']),
      '**head**\na\nb',
    );
  })

  it('never splits a line and counts what it drops', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i} ` + 'x'.repeat(90));
    const result = joinLinesWithinLimit('**head**', lines);
    assert.ok(result.length <= 2000);
    // Every included line is intact
    for (const line of result.split('\n').slice(1, -1)) {
      assert.ok(lines.includes(line), `split line: ${line}`);
    }
    assert.match(result, /\.\.\. and \d+ more/);
  })
})
