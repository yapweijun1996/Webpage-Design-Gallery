# Repository Guidelines

## Project Purpose and Structure

This repository is intended to showcase webpage UI/UX designs and interactive demos, including dashboards, landing pages, admin panels, and components. It currently contains only `.gitattributes`; no source, asset, or test directories have been established. Keep each future demo self-contained and group its HTML, CSS, JavaScript, and assets together. Add a short README explaining how to open and use a demo when its setup is not obvious.

## Development and Verification

There is currently no package manifest, build system, or automated test command. For a standalone HTML demo, open its HTML file in a browser; if it requires a local server, document the exact command and prerequisites in the demo's README. Do not add dependencies or build tooling without a clear need.

Before submitting changes, inspect `git status --short` and review `git diff`. Open affected demos in a browser and check desktop, tablet, and mobile layouts. Exercise changed controls, navigation, and keyboard interactions; check the browser console for errors. Document any checks that could not be performed.

## Coding Style and Assets

Write code, identifiers, comments, and documentation in English. Follow the existing style within each demo; use consistent indentation and descriptive, lowercase, hyphenated filenames such as `sales-dashboard.html`. Keep HTML semantic, CSS organized, and JavaScript focused on the behavior it controls. Provide accessible labels, visible keyboard focus, and useful alternative text where appropriate. Use assets that may legally be included and credit their sources when required.

## Testing Guidelines

No testing framework or coverage target is configured. Add focused automated tests when a demo introduces behavior that benefits from them, and document the command and prerequisites alongside that demo. Name test files so their relationship to the feature is clear, for example `navigation.test.js`. Do not report manual visual checks as automated coverage.

## Commits and Pull Requests

The current Git history contains only `Initial commit`, so no established commit convention can be inferred. Use short, descriptive, imperative commit subjects, such as `Add responsive analytics dashboard`. Keep changes focused. Pull requests should explain the purpose and behavior, list verification performed, link relevant issues when available, and include screenshots or recordings for visual changes.