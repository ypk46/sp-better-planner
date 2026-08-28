# Security Policy

## Supported Versions

Only the latest release of Better Planner is supported with security fixes.

| Version | Supported |
| ------- | --------- |
| Latest  | ✅        |
| Older   | ❌        |

## Reporting a Vulnerability

Please **don't** open a public issue for a security vulnerability. Instead, report it privately
using one of these:

- [GitHub Security Advisories](../../security/advisories/new) (preferred) — use the "Report a
  vulnerability" button on this repo's Security tab.
- Email `yuyik46@gmail.com` with the subject line `[Better Planner security]`.

You can expect an acknowledgement within 72 hours and an initial assessment within 7 days.
I'll work with you on a coordinated disclosure timeline and credit you in the fix, if you'd
like.

## Scope

In scope: this plugin's own code — how it renders task data into the DOM, how it uses
`PluginAPI` (permissions, hooks), and how it stores plugin-local state via
`persistDataSynced`/`loadSyncedData`.

Out of scope: the host [Super Productivity](https://github.com/super-productivity/super-productivity)
application itself and its `PluginAPI` — please report those upstream, in that project's own
repository.
