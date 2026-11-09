# Privacy policy

Last updated: 6 November 2026

Workflow Viewer for Bitbucket does not collect, store or share any personal data or repository content. This policy explains what the app reads and why.

The app is published by Søren Schytz Birk ("the publisher") on the Atlassian Marketplace.

## What the app reads

When a signed-in Bitbucket user opens the viewer, the app reads the following from the repository being viewed:

| Data | Why |
| --- | --- |
| Contents of `.xaml` and `project.json` files | To draw the workflow and the project overview |
| The list of files in the repository | To find workflows and `project.json` |
| Branch names and the main branch | To let the user pick a branch in the overview |

The app reads this through the Bitbucket Cloud REST API, using Atlassian Forge, with the permissions of the signed-in user. It only reads what that user can already see in Bitbucket.

The only Bitbucket permission the app requests is `read:repository:bitbucket`. It cannot change code, settings, users or pipelines.

## What the app does not do

- **No storage:** it stores nothing, either in Forge storage or in browser storage.
- **No outbound traffic:** it sends nothing to the publisher or any third party, and declares no outbound network access. Forge's content security policy blocks any host the app does not declare.
- **No tracking:** it uses no analytics, tracking or cookies of its own.
- **No server:** the publisher runs no server for the app. Atlassian hosts the app's static files on Forge.

Data is processed only in the user's browser while the page is open. The publisher has no access to it.

## Atlassian

Bitbucket Cloud and the Forge platform are operated by Atlassian. Their handling of data is covered by [Atlassian's privacy policy](https://www.atlassian.com/legal/privacy-policy).

## Changes

Changes to this policy are listed in [CHANGELOG.md](CHANGELOG.md), and the date at the top is updated. A version of the app that needs new permissions or outbound access waits for a workspace admin's approval before it applies, as Forge requires.

## Contact

Questions about privacy: email [workflow-viewer-for-bitbucket@outlook.com](mailto:workflow-viewer-for-bitbucket@outlook.com), or open an issue at [github.com/sorenbcoding/workflow-viewer-for-bitbucket/issues](https://github.com/sorenbcoding/workflow-viewer-for-bitbucket/issues). Report security problems privately as described in [SECURITY.md](SECURITY.md).

---

Workflow Viewer for Bitbucket is an independent open-source project by Søren Schytz Birk (github.com/sorenbcoding) and is not affiliated with, endorsed by, or sponsored by UiPath. UiPath and related names are trademarks of UiPath Inc. Bitbucket and Atlassian are trademarks of Atlassian Pty Ltd.
