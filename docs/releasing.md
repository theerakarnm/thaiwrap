# Releasing thaiwrap

Releases are made by release-please and published with npm and crates.io trusted publishing.
No npm or crates.io token is stored anywhere.
Follow these steps in order.

0. One-time: in GitHub, open Settings -> Actions -> General -> Workflow permissions.
   Enable "Allow GitHub Actions to create and approve pull requests".
   release-please needs it to open the release PR, and it is off by default.
   Check: `gh api repos/theerakarnm/thaiwrap/actions/permissions/workflow` shows `"can_approve_pull_request_reviews": true`.
1. One-time: create the npm organization `thaiwrap` at https://www.npmjs.com/org/create and be a member of it.
   Without it, publishing the `@thaiwrap/...` packages fails with E404.
   Run `npm login` (interactive, with 2FA).
   Run `node scripts/make-placeholders.mjs` and publish the 7 placeholder packages yourself.
   npm requires a package to exist before a trusted publisher can be configured for it.
2. One-time, within 2 days before the first release: run the printed `npm trust github ... --allow-publish` commands.
   npm expires unvalidated trusted-publisher configurations after 48 hours.
   If you miss the window, run the `npm trust` commands again.
   They need npm 11.15 or newer and a logged-in session with 2FA.
   Or set the same values in each package's Settings -> Trusted publishing: workflow `release.yml`, environment `npm`, direct publish allowed.
   Trusted publisher configurations created after 2026-09-03 allow only staged publishing unless direct publish is enabled for the package, so `--allow-publish` matters.
   The workflow file name must be `release.yml`, because npm matches the workflow that runs `npm publish`.
   Run `npm login` first if you logged out.
   Run `npm logout` after the last `npm trust` command, because the session token stays in `~/.npmrc` otherwise.
3. In GitHub, create the environment `npm` with yourself as required reviewer.
   Restrict its deployment branches to `main`, so only workflows on `main` can get the OIDC publish rights.
4. Release: merge the release PR that release-please opened.
   Approve the `npm` environment when asked, and the `crates-io` environment after the npm publish.
   Check that the `smoke-from-registry` and `install-macos-lockfile-on-linux` jobs pass.
5. Never store an npm or crates.io token in the repository or in its secrets.

## crates.io (one time, before the first release that includes the crate)

The release workflow publishes the Rust crate `thaiwrap` (the directory `crates/thaiwrap-core`) after npm, in the job `publish-crate`.
It gets a short-lived token from GitHub OIDC, so no crates.io token is stored.
crates.io requires the first publish of a crate to use an API token (https://crates.io/docs/trusted-publishing, Prerequisites: "Your crate must already be published to crates.io (initial publish requires an API token)").
So you publish a `0.0.0` placeholder by hand first.
The agent never publishes; these steps are yours.

1. Create a crates.io API token with the `publish-new` scope at https://crates.io/settings/tokens.
   Run `cargo login` and paste the token.
2. Run `node scripts/make-placeholders.mjs`.
   It prints the placeholder crate directory and the `(cd "..." && cargo publish)` command.
   Run that command.
3. Revoke the token on crates.io and run `cargo logout`.
4. On crates.io open `thaiwrap` -> Settings -> Trusted Publishing -> GitHub.
   Enter owner `theerakarnm`, repository `thaiwrap`, workflow `release.yml`, environment `crates-io`.
5. In GitHub open Settings -> Environments -> New environment and create `crates-io`.
   Add yourself as a required reviewer.
   Limit its deployment branches to `main`.
6. Optional, after 0.2.0 is on crates.io: yank the `0.0.0` placeholder on its crates.io page.
7. Check: `curl -s -A thaiwrap https://crates.io/api/v1/crates/thaiwrap | grep -c '"max_version":"0.0.0"'` prints `1` before the release PR is merged.
   The trusted publisher must be listed on the crate's settings page.

release-please bumps `package.json`, `Cargo.toml` (`workspace.package.version`) and the `thaiwrap` and `thaiwrap-node` entries of `Cargo.lock` together, so `cargo publish --locked` sees a consistent lockfile.

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
Unpublish the main package `thaiwrap` first and the `@thaiwrap/binding-*` packages after it.
npm refuses to unpublish a package that another registry package still depends on, and `thaiwrap` lists them in `optionalDependencies`.
An unpublished version number can never be used again, so the fix must ship as a new version.
The publish job publishes the platform packages before the main package.
A failure halfway leaves only platform packages, which nothing depends on yet.
Re-run the job; napi-rs skips versions that already exist.

A crates.io version cannot be overwritten or deleted either.
If `publish-crate` fails after npm published, re-run that job.
If the version already shows on https://crates.io/crates/thaiwrap, the publish succeeded and no re-run is needed.
If a bad version reached crates.io, run `cargo yank --version <version> thaiwrap` and ship the fix as a new version.
