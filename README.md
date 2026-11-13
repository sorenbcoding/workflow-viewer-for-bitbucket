<p align="center">
  <img src="branding/workflow-viewer-for-bitbucket-light.svg#gh-light-mode-only" width="96" alt="Workflow Viewer for Bitbucket logo">
  <img src="branding/workflow-viewer-for-bitbucket-dark.svg#gh-dark-mode-only" width="96" alt="Workflow Viewer for Bitbucket logo">
</p>

<h1 align="center">Workflow Viewer for Bitbucket</h1>
<p align="center">By Søren Schytz Birk</p>

Workflow Viewer for Bitbucket shows UiPath `.xaml` workflows in Bitbucket Cloud as a read-only, compact designer view. You can review sequences, flowcharts and state machines without opening Studio.

- **File viewer:** open any `.xaml` file in the repository source view and pick **Workflow Viewer** from the dropdown at the right end of the file header.
- **Workflow overview:** a repository page, under **Apps** in the repository menu, that reads `project.json`. It shows entry points, the tree of invoked workflows, workflows no entry point calls, and dependencies.
- **Read-only, as the current user:** the app calls the Bitbucket REST API with the viewer's own permissions, using the `read:repository:bitbucket` scope only. It stores nothing.

## Install

The app is a [Forge](https://developer.atlassian.com/platform/forge/) app. You deploy it into your own Bitbucket workspace; it does not need to be on the Atlassian Marketplace.

Requirements: Node.js 22 or later, and an Atlassian account with admin rights on the Bitbucket workspace.

```sh
npm install -g @forge/cli
forge login                       # once, with an Atlassian API token

git clone https://github.com/sorenbcoding/workflow-viewer-for-bitbucket.git
cd workflow-viewer-for-bitbucket
npm install

cd apps/forge-app
forge register                    # once, writes your app id into manifest.yml
npm run deploy                    # builds the UI and runs forge deploy
forge install --product bitbucket # pick your workspace
```

After installing, the app appears in two places:

- **Workflow Viewer:** open a `.xaml` file in the repository's **Source** view. Use the dropdown at the right end of the file header, the bar above the code that shows the file path, and choose **Workflow Viewer**. It is not in the Source / Diff / History dropdown at the top of the page.
- **Workflow overview:** in the repository's left menu, expand **Apps** near the bottom. The page is listed under **Workflow Viewer for Bitbucket**. A development install shows `(default)` after the names.

To roll out a new version, run `npm run deploy` again; installed workspaces update automatically. For production, use `forge deploy -e production` and `forge install -e production`. To install in other workspaces without a Marketplace listing, use the install link under **Distribution** in the [Developer console](https://developer.atlassian.com/console/myapps/).

### Local development

```sh
npm install
npm run dev      # dev harness at http://localhost:5173 with the samples in samples/
npm test         # parser tests
npm run typecheck
```

The dev harness can also open a local project folder or a single `.xaml` file. Files are read in the browser and never uploaded.

## Quick example

Open `Process.xaml` in the Bitbucket source view and select **Workflow Viewer**. The viewer shows:

```
▾ Process                                Sequence
  ▾ Try process invoice                  TryCatch
    Try
      ▾ Process invoice                  Sequence
          Invoke ValidateInvoice         InvokeWorkflowFile   Open
            Framework\ValidateInvoice.xaml
        ▾ Use Application: Invoice Portal NApplicationCard
            Body · WSSessionData
            ▸ Do                         Sequence
    Catch (BusinessRuleException) · businessException
        Log business exception           LogMessage
          Error: businessException.Message
    Finally
        Log finished                     LogMessage
```

Click an activity to see its properties and the variables in its scope. **Open** on an Invoke Workflow File activity goes to the invoked file. Flowcharts and state machines are drawn on a canvas at the positions Studio saved.

## Reference

### Repository layout

| Path | Contents |
| --- | --- |
| `packages/xaml-core` | Parser for `.xaml` and `project.json` into a plain activity model. TypeScript only, no DOM. |
| `packages/xaml-render` | React components: `WorkflowView`, `ProjectOverview`, `GraphCanvas`, `AboutFooter`. |
| `apps/forge-app` | Forge manifest and Custom UI for the file viewer and the workflow overview page. |
| `apps/dev-harness` | Local Vite app for working on the renderer. |
| `samples/` | Synthetic sample project used by tests and the harness. |
| `branding/` | Product logo, light and dark, as SVG and as PNG at 16 to 128 px. |

### Supported workflow content

| Content | Shown as |
| --- | --- |
| Sequence, Parallel, Pick | Nested activity blocks |
| If, Switch | Then and Else side by side; one block per case and Default |
| Try Catch | Try, one section per catch type with its exception variable, Finally |
| For Each, For Each Row, While, Do While, scopes such as Use Application/Browser and Use Excel File | Body with its delegate argument, e.g. `Body · row` |
| Flowchart | Canvas with Studio positions and connectors; Flow Decision and Flow Switch with branch labels |
| State Machine | Canvas with states, final states and labelled transitions; entry, exit, trigger, action and condition for the selected state |
| Invoke Workflow File | Target path with an **Open** link; dynamic paths are marked |
| Arguments, variables, annotations | Tables and notes; VB and C# expressions shown as written |
| Activities from any package | A generic block with display name, type and properties |

If a file is not valid XML, the view says what failed and how to fix it. Broken flowchart or state machine references become warnings instead of errors.

### Workflow overview

The overview reads every `.xaml` file under the folder that holds `project.json`. Repositories with several projects get a project selector. The overview shows:

- **Entry points and invoked workflows:** the call tree from each entry point. Missing files, dynamic paths and recursive invokes are marked. A workflow invoked from several places is expanded the first time and marked **Shown above** after that.
- **Workflows:** argument count, invoke count, and whether an entry point or test case reaches the workflow.
- **Dependencies:** package versions from `project.json`.

### Permissions

| Scope | Why |
| --- | --- |
| `read:repository:bitbucket` | Read files, the file list, branches and the main branch. |

### Support, security and privacy

- [SUPPORT.md](SUPPORT.md): how to get help and report bugs.
- [SECURITY.md](SECURITY.md): how to report a vulnerability privately, and response times.
- [PRIVACY.md](PRIVACY.md): what the app reads. It stores and sends nothing.
- [END-USER-TERMS.md](END-USER-TERMS.md): terms for using the app from the Atlassian Marketplace. It is free, MIT-licensed and provided as is.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT. See [LICENSE](LICENSE).

---

By Søren Schytz Birk · UiPath Community MVP · [github.com/sorenbcoding](https://github.com/sorenbcoding)

Workflow Viewer for Bitbucket is an independent open-source project by Søren Schytz Birk (github.com/sorenbcoding) and is not affiliated with, endorsed by, or sponsored by UiPath. UiPath and related names are trademarks of UiPath Inc. Bitbucket and Atlassian are trademarks of Atlassian Pty Ltd.
