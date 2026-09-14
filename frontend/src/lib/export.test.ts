import { describe, expect, it } from 'vitest';
import { buildView } from './brief';
import { toMarkdown } from './export';
import { brief, sampleBrief } from '../test/brief-fixture';
import type { Lane } from '../types/brief';

const NONE: ReadonlySet<Lane> = new Set();

function render(filter = '', expanded: ReadonlySet<Lane> = NONE): string {
  const source = sampleBrief();
  return toMarkdown({
    brief: source,
    view: buildView({ brief: source, filter, expanded }),
    filter,
  });
}

describe('toMarkdown', () => {
  it('renders the brief the way it is displayed', () => {
    expect(render()).toMatchInlineSnapshot(`
      "# acme/widgets

      Generated 2026-09-14 06:00 UTC for ada. 10 items, 1 blocking.

      ## Unblock others

      - [#101](https://github.com/acme/widgets/pull/101) Add retry to the uploader
        - Signal: grace requested your review today
        - Action: Review and leave a decision
        - Checkout: \`gh pr checkout 101\`

      ## Land work in flight

      - [#202](https://github.com/acme/widgets/pull/202) Drop the legacy exporter
        - Signal: approved by grace, branch is behind main
        - Action: Rebase, verify CI, then merge
        - Checkout: \`gh pr checkout 202\`

      2 PRs waiting on reviewers: #203, #204

      ## Needs a decision

      - [#301](https://github.com/acme/widgets/pull/301) Flaky integration suite
        - Signal: assigned to you 18d ago with no PR opened
        - Action: Scope it, or hand it off

      ## Pick up next

      - [#401](https://github.com/acme/widgets/pull/401) Claimable 401
        - Signal: open and unassigned for 4d
        - Action: Claim it if it fits your current work
      - [#402](https://github.com/acme/widgets/pull/402) Claimable 402
        - Signal: open and unassigned for 4d
        - Action: Claim it if it fits your current work
      - [#403](https://github.com/acme/widgets/pull/403) Claimable 403
        - Signal: open and unassigned for 4d
        - Action: Claim it if it fits your current work

      2 more not shown. Expand in GitHelp to include them.
      "
    `);
  });

  it('discloses the filter so a partial list is never passed off as whole', () => {
    const output = render('claimable');
    expect(output).toContain('Filtered by "claimable", 5 matching.');
    expect(output).not.toContain('#101');
  });

  it('drops the truncation notice once the lane is expanded', () => {
    const output = render('', new Set<Lane>(['pick_up_next']));
    expect(output).toContain('#405');
    expect(output).not.toContain('more not shown');
  });

  it('says so when there is nothing to report', () => {
    const source = brief([]);
    const output = toMarkdown({
      brief: source,
      view: buildView({ brief: source, filter: '', expanded: NONE }),
    });
    expect(output).toContain('Nothing is waiting on you.');
  });

  it('says so when the filter matched nothing', () => {
    expect(render('kubernetes')).toContain('No items match the filter.');
  });
});
