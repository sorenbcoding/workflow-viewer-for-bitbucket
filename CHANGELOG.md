# Changelog

All notable changes to Workflow Viewer for Bitbucket are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- SECURITY.md, PRIVACY.md and SUPPORT.md, linked from the README. Private vulnerability reporting is enabled on GitHub.
- CI on GitHub Actions (typecheck, tests, Forge build, production dependency audit) and Dependabot for npm and actions.
- The properties panel shows the full .NET type under the XAML tag, e.g. `UiPath.Excel.Activities.Business.ReadRangeX`. Types from shared schema URIs are inferred and marked with a tooltip.
- Multiple Assign shows one `To = Value` row per assignment on the canvas (first 8, with Show all) and as a To/Value table in the properties panel.
- A collapsed Imports section lists the workflow's imported namespaces, read from `NamespacesForImplementation` or the older `VisualBasic.Settings` form.
- Properties with several values, such as Filter Data Table filters, show one value per line.
- Filter Data Table conditions are shown as rows, e.g. `"Age" > 18` and `Or "Name" not empty`, with the first condition on the canvas.

### Fixed
- Development tools upgraded to Vite 8, @vitejs/plugin-react 6 and Vitest 5, clearing their moderate advisories.
- The workflow overview reads at most 300 workflows when it opens, entry points first. Others are listed as Not read and read when opened. The dev harness accepts `?maxFiles=N` to try this.
- Files that declare a `DOCTYPE` or are larger than 5 MB are rejected with a clear message instead of being parsed.
- High-severity advisory in `prosemirror-view`, pulled in by `@forge/bridge`, cleared with an npm override. The package is not part of the app bundle.
- Properties that hold lists of objects, such as Filter Data Table filters, lost their operators and showed cut-off text such as `"Age"] [18`.
- `formatExpression` no longer strips brackets that do not wrap the whole expression.

## [0.1.0] - 2026-10-19

### Added
- `xaml-core` parser for UiPath `.xaml` workflows: sequences, If, Switch, Try Catch, loops, delegate bodies, flowcharts, state machines, arguments, variables, annotations, VB and C# expressions, and unknown activities.
- `project.json` parser with entry points, dependencies, test cases, and an invoke tree builder.
- `xaml-render` React components: compact designer view, flowchart and state machine canvas using Studio positions, properties panel, project overview.
- Forge app with a `.xaml` file viewer (`bitbucket:repoCodeFileViewer`) and a workflow overview page (`bitbucket:repoMainMenuPage`).
- Dev harness with a synthetic sample project, local folder and single-file preview.
