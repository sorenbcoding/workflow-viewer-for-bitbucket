# Marketplace listing: Workflow Viewer for Bitbucket

Draft for the Atlassian Marketplace. The app is free and uses an informational listing, which the Forge listing guide describes for Bitbucket Forge apps. The text follows the SorenB brand template, adapted from UiPath's Marketplace to Atlassian's.

## Basics

| Field | Value |
| --- | --- |
| App name | Workflow Viewer for Bitbucket |
| Product | Bitbucket Cloud |
| Platform | Forge (Custom UI, no backend functions) |
| Price | Free |
| Partner (publisher) | Søren Schytz Birk |
| Category accent | Slate |
| Logo | `branding/workflow-viewer-for-bitbucket-light-128.png` (SVG: `branding/workflow-viewer-for-bitbucket-light.svg`) |

## Summary

Shows UiPath `.xaml` workflows in Bitbucket Cloud as a read-only, compact designer view, so reviewers can follow an automation without opening Studio.

## Description

Workflow Viewer for Bitbucket adds a **Workflow Viewer** option to the file menu for `.xaml` files in the repository source view. It draws the workflow the way UiPath Studio's compact designer does:
- Sequences, If, Switch and Try Catch as nested activity blocks.
- Flowcharts and state machines on a canvas, at the positions Studio saved.
- Arguments, variables and imports in collapsible tables.
- A properties panel with the full activity type, e.g. `UiPath.Core.Activities.FilterDataTable`.
- Invoke Workflow File activities link to the invoked file.

A **Workflow overview** page in the repository menu reads `project.json` and shows:
- entry points and the tree of invoked workflows;
- workflows that no entry point calls;
- package dependencies, for any branch.

The app is read-only. It requests only `read:repository:bitbucket` and reads files as the signed-in user, so people see only what they can already see in Bitbucket. Nothing is stored or sent anywhere. It supports Windows, Windows-Legacy and cross-platform projects, with VB or C# expressions. Activities from any package are shown with their name, type and properties.

By Søren Schytz Birk · UiPath Community MVP · github.com/sorenbcoding

## Highlights

| # | Title | Text | Image |
| --- | --- | --- | --- |
| 1 | Read workflows without Studio | Open any `.xaml` file in Bitbucket and see its sequences, conditions and error handling as activity blocks, with a properties panel for the selected activity. | `docs/marketplace/screenshot-2-sequence.png` |
| 2 | Flowcharts and state machines as Studio drew them | Steps, decisions, switches, states and transitions are drawn at Studio's saved positions, with branch and transition labels. | `docs/marketplace/screenshot-3-flowchart.png`, `docs/marketplace/screenshot-4-state-machine.png` |
| 3 | See the whole project | The Workflow overview lists entry points, the call tree, workflows nothing invokes, and dependencies, for any branch. | `docs/marketplace/screenshot-1-overview.png` |

Hero image: `docs/marketplace/hero.png`.

All images were captured from the dev harness at 1600 × 900 px using the synthetic sample project in `samples/`. They contain no customer or employer workflows.

## Scopes and hosts (for Atlassian's review)

| Scope | Why the app needs it |
| --- | --- |
| `read:repository:bitbucket` | Read `.xaml` and `project.json` contents, the file list, branch names and the main branch of the repository being viewed. Requests run as the signed-in user. |

| Remote host | Data sent |
| --- | --- |
| None | The app declares no outbound access (`permissions.external` is empty) and has no backend. |

## Privacy and Security tab (draft answers)

| Question area | Answer |
| --- | --- |
| Does the app store end-user data? | No. No Forge storage, no browser storage, no logs. |
| Does the app send data outside Atlassian? | No. No remote hosts are declared and the app has no backend. |
| What data does the app process? | Repository file contents (`.xaml`, `project.json`), file list and branch names, in the user's browser only, while the page is open. |
| Personal data | The publisher receives none. Repository content may contain names, but it never leaves Bitbucket and the user's browser. |
| Data residency | Not applicable. Nothing is stored. |
| Encryption | Atlassian's Forge platform serves the app and handles all traffic between it and Bitbucket. The app adds no connections of its own. |
| Security contact and vulnerability reporting | [SECURITY.md](../SECURITY.md): GitHub private vulnerability reporting, first response within 5 working days. |
| Privacy policy | [PRIVACY.md](../PRIVACY.md) |

## URLs

| Field | URL |
| --- | --- |
| Documentation | https://github.com/sorenbcoding/workflow-viewer-for-bitbucket#readme |
| Support | https://github.com/sorenbcoding/workflow-viewer-for-bitbucket/blob/main/SUPPORT.md |
| Privacy policy | https://github.com/sorenbcoding/workflow-viewer-for-bitbucket/blob/main/PRIVACY.md |
| Security | https://github.com/sorenbcoding/workflow-viewer-for-bitbucket/blob/main/SECURITY.md |
| Source code | https://github.com/sorenbcoding/workflow-viewer-for-bitbucket |
| Issue tracker | https://github.com/sorenbcoding/workflow-viewer-for-bitbucket/issues |

## Disclaimer (last part of the description)

Workflow Viewer for Bitbucket is an independent open-source project by Søren Schytz Birk (github.com/sorenbcoding) and is not affiliated with, endorsed by, or sponsored by UiPath. UiPath and related names are trademarks of UiPath Inc. Bitbucket and Atlassian are trademarks of Atlassian Pty Ltd.

## Before submitting

- [ ] Check the image sizes and formats against Atlassian's current "Building your presence on Marketplace" guidance, and resize the logo, hero and screenshots if needed. The 1600 × 900 px size used here has not been checked against it.
- [ ] Check that the app name is allowed under Atlassian's naming and trademark rules for Marketplace apps ("… for Bitbucket").
- [ ] Decide on the end user terms. The source is MIT-licensed. Check whether a free informational listing needs separate end user terms or can link the LICENSE.
- [ ] Deploy to production (`forge deploy -e production`) and confirm the live checks in the security assessment.
- [ ] Enable sharing for the app and publish the developer space in the developer console.
- [ ] Create the Marketplace partner profile, then submit at marketplace.atlassian.com/manage/apps/create.

Source: [Listing Forge apps on the Atlassian Marketplace](https://developer.atlassian.com/platform/marketplace/listing-forge-apps/), [Creating a Marketplace listing](https://developer.atlassian.com/platform/marketplace/creating-a-marketplace-listing/) and [App approval guidelines](https://developer.atlassian.com/platform/marketplace/app-approval-guidelines/), read on 6 November 2026.
