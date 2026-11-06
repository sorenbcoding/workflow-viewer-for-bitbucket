# Security policy

Workflow Viewer for Bitbucket is a read-only Forge app for Bitbucket Cloud. It has no server, stores no data and asks only for the `read:repository:bitbucket` scope. See [PRIVACY.md](PRIVACY.md) for what it reads.

## Supported versions

Only the version currently published on the Atlassian Marketplace, which is the latest release in this repository, receives security fixes. Forge applies minor updates to every installation automatically.

## Report a vulnerability

Report it privately via [GitHub private vulnerability reporting](https://github.com/sorenbcoding/workflow-viewer-for-bitbucket/security/advisories/new). Do not open a public issue.

Include:
- what an attacker can do, and what they need, e.g. commit access to a repository;
- steps or a minimal `.xaml` file that reproduces it, with any real workflow content anonymised;
- the app version shown under **About** in the viewer.

## What happens next

| Step | Time |
| --- | --- |
| First response | Within 5 working days |
| Assessment and severity | Within 10 working days |
| Fix released | Within the timeframe of Atlassian's Marketplace security SLAs for that severity |

Vulnerabilities that Atlassian reports through its Marketplace security process are handled the same way and within the same SLAs. Fixed issues are listed in [CHANGELOG.md](CHANGELOG.md), and a GitHub security advisory is published once installations are updated.

## Scope

In scope: the Forge app in `apps/forge-app`, and the parser and renderer packages it bundles.

Out of scope:
- the local dev harness (`apps/dev-harness`), which only runs on a developer's machine;
- Bitbucket Cloud and the Forge platform themselves. Report those to [Atlassian](https://www.atlassian.com/trust/security/report-a-vulnerability).

---

Workflow Viewer for Bitbucket is an independent open-source project by Søren Schytz Birk (github.com/sorenbcoding) and is not affiliated with, endorsed by, or sponsored by UiPath. UiPath and related names are trademarks of UiPath Inc. Bitbucket and Atlassian are trademarks of Atlassian Pty Ltd.
