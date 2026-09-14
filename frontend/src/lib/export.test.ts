import { describe, expect, it } from 'vitest';
import { buildView } from './brief';
import { toMarkdown } from './export';
import { brief, sampleBrief } from '../test/brief-fixture';

function render(filter = ''): string {
  const source = sampleBrief();
  return toMarkdown({
    brief: source,
    view: buildView({ brief: source, filter }),
    filter,
  });
}

describe('toMarkdown', () => {
  it('renders the brief the way it is displayed', () => {
    expect(render()).toMatchInlineSnapshot(`
      "# acme/widgets

      Generated 2026-09-14 06:00 UTC for ada. 11 items.

      ## Unblock others

      - [#101](https://github.com/acme/widgets/pull/101) Add retry to the uploader
        - Signal: grace requested your review today
        - Next step: Review it
        - Checkout: \`gh pr checkout 101\`
      - [#102](https://github.com/acme/widgets/pull/102) Split the ingest worker
        - Signal: hopper commented 3d ago and has not had a reply
        - Next step: Reply to hopper
        - Waiting on you since: hopper spoke last
        - Checkout: \`gh pr checkout 102\`

      ## Land work in flight

      - [#202](https://github.com/acme/widgets/pull/202) Drop the legacy exporter
        - Signal: approved by grace, branch is behind main
        - Next step: Update branch, then merge
        - Checkout: \`gh pr checkout 202\`
      - [#203](https://github.com/acme/widgets/pull/203) Tidy the config loader
        - Signal: waiting on grace to review
        - Next step: none
      - [#204](https://github.com/acme/widgets/pull/204) Bump the pinned toolchain
        - Signal: waiting on grace to review
        - Next step: none

      ## Needs a decision

      - [#301](https://github.com/acme/widgets/pull/301) Flaky integration suite
        - Signal: assigned to you 18d ago with no PR opened, board status Todo
        - Next step: Scope it
        - Board status: Todo

      ## Pick up next

      - [#401](https://github.com/acme/widgets/pull/401) Claimable 401
        - Signal: open and unassigned for 4d
        - Next step: none
      - [#402](https://github.com/acme/widgets/pull/402) Claimable 402
        - Signal: open and unassigned for 4d
        - Next step: none
      - [#403](https://github.com/acme/widgets/pull/403) Claimable 403
        - Signal: open and unassigned for 4d
        - Next step: none
      - [#404](https://github.com/acme/widgets/pull/404) Claimable 404
        - Signal: open and unassigned for 4d
        - Next step: none
      - [#405](https://github.com/acme/widgets/pull/405) Claimable 405
        - Signal: open and unassigned for 4d
        - Next step: none
      "
    `);
  });

  it('discloses the filter so a partial list is never passed off as whole', () => {
    const output = render('claimable');
    expect(output).toContain('Filtered by "claimable", 5 matching.');
    expect(output).not.toContain('#101');
  });

  it('never omits a row from an unfiltered export', () => {
    const output = render();
    for (const number of [101, 102, 202, 203, 204, 301, 401, 402, 403, 404, 405]) {
      expect(output).toContain(`#${number}`);
    }
  });

  it('says so when there is nothing to report', () => {
    const source = brief([]);
    const output = toMarkdown({
      brief: source,
      view: buildView({ brief: source, filter: '' }),
    });
    expect(output).toContain('Nothing is waiting on you.');
  });

  it('says so when the filter matched nothing', () => {
    expect(render('kubernetes')).toContain('No items match the filter.');
  });
});
