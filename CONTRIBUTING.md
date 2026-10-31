# Contributing to thaiwrap

Thank you for helping.

## Report a wrong split

Open an issue with:

- the input text
- the `maxLength` and options you used
- the output you got
- the output you expected

## Set up

Requirements: Rust (stable, pinned in `rust-toolchain.toml`), Node.js 22+, Bun.

```bash
bun install
bun run build
```

## Before you open a pull request

Run all four checks:

```bash
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
bun run build && bun test
```

## Rules

- Keep the acceptance test in the README working.
- Start bug fixes with a failing test.
- Keep all logic in `crates/thaiwrap-core`. The Node binding only converts types and validates input.
- Open an issue first before adding a dependency or changing the public API.
- Do not edit `CHANGELOG.md`, `binding.d.ts` or `binding.js` by hand. They are generated.
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `perf:`, `test:`, `docs:`, `refactor:`, `chore:`, `ci:`.
- A change that claims to be faster must include `cargo bench` numbers before and after.
- Update `README.md` when public behavior or options change.

See [AGENTS.md](AGENTS.md) for the full engineering and Thai text rules.
