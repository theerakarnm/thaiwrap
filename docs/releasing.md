# Releasing thaiwrap

Releases are made by release-please and published with npm trusted publishing.
No npm token is stored anywhere.
Follow these steps in order.

0. One-time: in GitHub, open Settings -> Actions -> General -> Workflow permissions.
   Enable "Allow GitHub Actions to create and approve pull requests".
   release-please needs it to open the release PR, and it is off by default.
   Check: `gh api repos/theerakarnm/thaiwrap/actions/permissions/workflow` shows `"can_approve_pull_request_reviews": true`.
1. One-time: create the npm org `thaiwrap`.
   Run `node scripts/make-placeholders.mjs` and publish the 7 placeholder packages yourself.
   npm requires a package to exist before a trusted publisher can be configured for it.
2. One-time, within 2 days before the first release: run the printed `npm trust github ... --allow-publish` commands.
   They need npm 11.15 or newer and 2FA.
   Or set the same values in each package's Settings -> Trusted publishing: workflow `release.yml`, environment `npm`, direct publish allowed.
   Trusted publisher configurations created after 2026-09-03 allow only staged publishing unless direct publish is enabled for the package, so `--allow-publish` matters.
   The workflow file name must be `release.yml`, because npm matches the workflow that runs `npm publish`.
3. In GitHub, create the environment `npm` with yourself as required reviewer.
4. Release: merge the release PR that release-please opened.
   Approve the `npm` environment when asked.
   Check that the `smoke-from-registry` and `install-macos-lockfile-on-linux` jobs pass.
5. Never store an npm token in the repository or in its secrets.

## Notes

- Release PRs opened with `GITHUB_TOKEN` do not trigger `ci.yml`.
  The release run builds and tests everything again before it publishes.
- If you later make CI checks required on `main`, the release PR cannot be merged without a manual workaround.
  One option is a personal token for release-please.
- A tag created with `GITHUB_TOKEN` does not start other workflows.
  For that reason publishing lives in `release.yml` itself, gated on the release-please output.

## Rollback

A published npm version cannot be overwritten.
Within 72 hours, `npm unpublish <name>@<version>` works.
After that, only `npm deprecate` is possible.
The publish job publishes the platform packages before the main package.
A failure halfway leaves only platform packages, which nothing depends on yet.
Re-run the job; napi-rs skips versions that already exist.
