# Marketplace listing: Workflow Viewer for Bitbucket

Draft for the Atlassian Marketplace, checked against Atlassian's listing requirements on 9 November 2026. Bitbucket Forge apps use an informational listing: the listing makes the app discoverable, and installation stays with the developer-console install link. The app is free.

Lengths are counted in characters. The draft is generated so that no field exceeds its limit.

## Listing text

| Field | Text | Length |
| --- | --- | --- |
| App name | Workflow Viewer for Bitbucket | 29 / 60 |
| Tagline | View UiPath workflows in Bitbucket Cloud as a read-only designer canvas, without opening UiPath Studio. | 103 / 130 |
| Summary | Adds a Workflow Viewer to .xaml files and a Workflow overview page to repositories, so reviewers can follow UiPath sequences, flowcharts and state machines in Bitbucket. Read-only, as the signed-in user. | 203 / 250 |
| Release summary | First release: Workflow Viewer for .xaml files and Workflow overview page. | 74 / 80 |

### More details (806 / 1000)

Workflow Viewer for Bitbucket draws UiPath .xaml files the way Studio's compact designer does: sequences, If, Switch and Try Catch as nested activity blocks, flowcharts and state machines at Studio's saved positions, plus arguments, variables, imports and a properties panel with the full activity type. Invoke Workflow File activities link to the invoked file.

The Workflow overview page reads project.json and shows entry points, the call tree, workflows nothing invokes, and dependencies, for any branch.

The app is read-only and asks only for read:repository:bitbucket. Files are read as the signed-in user and are never stored or sent anywhere. Windows, Windows-Legacy and cross-platform projects with VB or C# expressions are supported.

Independent open-source project; not affiliated with UiPath.

## Highlights

Atlassian requires exactly three highlights.

### Highlight 1

| Field | Text | Length |
| --- | --- | --- |
| Title | Read workflows without Studio | 29 / 50 |
| Summary | Pick Workflow Viewer from the file header dropdown of any .xaml file. Sequences, conditions and error handling show as activity blocks, with a properties panel for the selected activity. | 186 / 220 |
| Screenshot caption | Process.xaml with a Filter Data Table selected: its conditions, columns and full type in the properties panel. | 110 / 220 |
| Screenshot (1840 × 900) | `docs/marketplace/highlight-1-sequence.png` | |
| Cropped screenshot (580 × 330) | `docs/marketplace/highlight-1-sequence-crop.png` | |

### Highlight 2

| Field | Text | Length |
| --- | --- | --- |
| Title | Flowcharts and state machines as Studio drew them | 49 / 50 |
| Summary | Steps, decisions, switches, states and transitions are drawn at the positions Studio saved, with branch and transition labels. Pan, zoom and click a node to see what it does. | 174 / 220 |
| Screenshot caption | A flowchart with a Flow Decision selected and its condition shown below the canvas. | 83 / 220 |
| Screenshot (1840 × 900) | `docs/marketplace/highlight-2-flowchart.png` | |
| Cropped screenshot (580 × 330) | `docs/marketplace/highlight-2-flowchart-crop.png` | |

### Highlight 3

| Field | Text | Length |
| --- | --- | --- |
| Title | See the whole project | 21 / 50 |
| Summary | The Workflow overview under Apps reads project.json and lists entry points, the tree of invoked workflows, workflows nothing invokes, and dependencies, for any branch. | 167 / 220 |
| Screenshot caption | The overview of a sample project: entry point, invoke tree with a dynamic path, workflows and dependencies. | 107 / 220 |
| Screenshot (1840 × 900) | `docs/marketplace/highlight-3-overview.png` | |
| Cropped screenshot (580 × 330) | `docs/marketplace/highlight-3-overview-crop.png` | |

### Additional media

| Highlight | Explanation | Length | Image |
| --- | --- | --- | --- |
| 2 | A state machine with its states and labelled transitions, and the entry actions of the selected state. | 102 / 220 | `docs/marketplace/highlight-2-extra-state-machine.png` |

## Logo and banner

| Asset | Required | File |
| --- | --- | --- |
| App logo | 144 × 144 px PNG, transparent or bounded background | `docs/marketplace/app-logo-144.png` |
| Banner | 1120 × 548 px, with app name, partner name and what it does | `docs/marketplace/banner-1120x548.png` |

All screenshots come from the dev harness and use only the synthetic sample project in `samples/`.

## Partner profile

| Field | Text | Length |
| --- | --- | --- |
| Partner name | Søren Schytz Birk | 17 / 40 |
| Description | Søren Schytz Birk is a UiPath developer and UiPath Community MVP who builds open-source tools that help automation teams review and maintain their UiPath projects. All tools are published with their source code at github.com/sorenbcoding. | 238 / 750 |
| Partner logo | `docs/marketplace/partner-logo-144.png`: the SorenB master mark, 144 × 144 px, transparent background | |
| Security contact email | workflow-viewer-for-bitbucket@outlook.com | |
| Contact email | workflow-viewer-for-bitbucket@outlook.com (keep the private address for login and billing only) | |

The vendor is the developer space **Søren Schytz Birk**, which owns the app. The `sorenbcoding` space is also published; do not use it as vendor. After publishing, the profile fields above are edited in the Marketplace, not in the developer console: marketplace.atlassian.com → avatar → **Manage partner account** → **Søren Schytz Birk** → partner profile and contacts.

## Links

| Field | URL |
| --- | --- |
| Documentation | https://github.com/sorenbcoding/workflow-viewer-for-bitbucket#readme |
| Support | https://github.com/sorenbcoding/workflow-viewer-for-bitbucket/blob/main/SUPPORT.md |
| Privacy policy | https://github.com/sorenbcoding/workflow-viewer-for-bitbucket/blob/main/PRIVACY.md |
| End user terms | https://github.com/sorenbcoding/workflow-viewer-for-bitbucket/blob/main/END-USER-TERMS.md (choose "No" for the standard agreement and link this file) |
| Source code | https://github.com/sorenbcoding/workflow-viewer-for-bitbucket |
| Licence | MIT ([LICENSE](../LICENSE)); it must match the licence reported in the listing |

## Scopes and hosts (for Atlassian's review)

| Scope | Why the app needs it |
| --- | --- |
| `read:repository:bitbucket` | Read `.xaml` and `project.json` contents, the file list, branch names and the main branch of the repository being viewed. Requests run as the signed-in user. |

| Remote host | Data sent |
| --- | --- |
| None | The app declares no outbound access and has no backend. Forge reports it as eligible for Runs on Atlassian. |

## Privacy and Security tab (draft answers)

| Question area | Answer |
| --- | --- |
| Does the app store end-user data? | No. No Forge storage, no browser storage, no logs. |
| Does the app send data outside Atlassian? | No. No remote hosts are declared and the app has no backend. |
| What data does the app process? | Repository file contents (`.xaml`, `project.json`), file list and branch names, in the user's browser only, while the page is open. |
| Personal data | The publisher receives none. Repository content may contain names, but it never leaves Bitbucket and the user's browser. |
| Data residency | Not applicable. Nothing is stored. |
| Security contact | The security contact email above, and [SECURITY.md](../SECURITY.md) |
| Privacy policy | [PRIVACY.md](../PRIVACY.md) |

## Naming check

"Workflow Viewer for Bitbucket" follows Atlassian's "App name for Product name" pattern (for example "Dropbox Connector for Bitbucket"):
- 29 characters, title case;
- does not start with "Bitbucket";
- no forbidden words (Atlassian, Premium, plugin, beta, add-on, app).

Atlassian checks uniqueness against existing listings during review.

## Before submitting

Done:
- [x] Security contact email in SECURITY.md and PRIVACY.md (workflow-viewer-for-bitbucket@outlook.com).
- [x] Sharing enabled in the developer console (distribution status: Sharing, product: Bitbucket).
- [x] Developer space **Søren Schytz Birk** published, and the app transferred into it. App ID unchanged.
- [x] Deployed to production (`forge deploy -e production`). The production installation link is on the Distribution page.

Still open:
- [ ] Sign in once at community.developer.atlassian.com with the personal Atlassian account.
- [ ] Partner profile for **Søren Schytz Birk**: name, description and logo from this file, and the Outlook address as contact and security contact.
- [ ] Partner verification, if the partner account asks for it.
- [ ] Get Atlassian support's answer on how to create the informational listing for a Bitbucket Forge app. The "publish a new app" form offers only Compass, Confluence and Jira for Forge apps. Do not pick one of those, and do not use the "App URL" (Connect) route.
- [ ] Submit the listing as support describes, and accept the Marketplace Partner Agreement.
- [ ] Fill in the Privacy and Security tab with the answers above.
- [ ] Expect 1 to 3 weeks for review, often with a few rounds of questions.

## Sources

Read on 9 November 2026:
- [Building your presence on Marketplace](https://developer.atlassian.com/platform/marketplace/building-your-presence-on-marketplace/)
- [Brand guidelines for Marketplace vendors](https://developer.atlassian.com/platform/marketplace/atlassian-brand-guidelines-for-marketplace-vendors/)
- [Listing Forge apps](https://developer.atlassian.com/platform/marketplace/listing-forge-apps/)
- [App approval guidelines](https://developer.atlassian.com/platform/marketplace/app-approval-guidelines/)
- [Customizable end user agreement](https://developer.atlassian.com/platform/marketplace/list-customizable-end-user-agreement/)
- [Security requirements for cloud apps](https://developer.atlassian.com/platform/marketplace/security-requirements/)

---

By Søren Schytz Birk · UiPath Community MVP · github.com/sorenbcoding

Workflow Viewer for Bitbucket is an independent open-source project by Søren Schytz Birk (github.com/sorenbcoding) and is not affiliated with, endorsed by, or sponsored by UiPath. UiPath and related names are trademarks of UiPath Inc. Bitbucket and Atlassian are trademarks of Atlassian Pty Ltd.
