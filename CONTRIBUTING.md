# Contributing

Thanks for your interest in Better Planner!

## Code contributions

This project is **not accepting code contributions (pull requests) at this time**. It's
maintained solo, and reviewing/maintaining external code against the constraints described in
[CLAUDE.md](CLAUDE.md) (the 100KB plugin size cap, the host app's plugin-API quirks) takes more
ongoing attention than I can commit to right now. Pull requests will be closed unopened.

## Feedback, bugs, and feature requests

This is exactly what I want to hear about:

- **Found a bug?** [Open a bug report](../../issues/new?template=bug_report.yml).
- **Have an idea or missing feature?** [Open a feature request](../../issues/new?template=feature_request.yml).
- **Security issue?** See [SECURITY.md](SECURITY.md) — please don't file it as a public issue.

Search existing issues first to avoid duplicates. A clear repro (or even just a screenshot) goes
a long way.

## Releasing (for reference)

Releases are automated with [Release Please](https://github.com/googleapis/release-please),
driven by [Conventional Commit](https://www.conventionalcommits.org/) messages
(`feat:`, `fix:`, `docs:`, etc.) on `main`. It maintains an up-to-date release pull request;
merging it bumps the version, updates `CHANGELOG.md`, and tags/publishes a GitHub Release.

`package.json`'s `version` field is the single source of truth. `src/manifest.json`'s `version`
field is kept in sync automatically by Release Please (via its `extra-files` config in
`.release-please-config.json`) — never hand-edit it, it'll be overwritten on the next release.
