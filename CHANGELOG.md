# Changelog

All notable changes to Workflow Viewer for Bitbucket are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-19

### Added
- `xaml-core` parser for UiPath `.xaml` workflows: sequences, If, Switch, Try Catch, loops, delegate bodies, flowcharts, state machines, arguments, variables, annotations, VB and C# expressions, and unknown activities.
- `project.json` parser with entry points, dependencies, test cases, and an invoke tree builder.
- `xaml-render` React components: compact designer view, flowchart and state machine canvas using Studio positions, properties panel, project overview.
- Forge app with a `.xaml` file viewer (`bitbucket:repoCodeFileViewer`) and a workflow overview page (`bitbucket:repoMainMenuPage`).
- Dev harness with a synthetic sample project, local folder and single-file preview.
