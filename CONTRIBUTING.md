# Contributing to Annotation

Thanks for considering a contribution. This project is in an early MVP stage, so focused feedback and small, reviewable pull requests are especially valuable.

## Before you start

- Search existing issues and pull requests to avoid duplicate work.
- For substantial changes, open an issue first to discuss the proposed behavior.
- Keep changes scoped and explain the user problem they solve.
- Do not include private datasets, credentials, API keys, or personally identifying sample data.

## Development setup

1. Install Node.js 20.19+ or 22.12+ and npm.
2. Fork the repository and clone your fork.
3. Run `npm ci`.
4. Start the app with `npm run dev`.

Before submitting, run:

```bash
npm run lint
npm run build
```

## Pull request checklist

- [ ] The PR has a clear description and links related issues.
- [ ] The change is focused and documented.
- [ ] UI changes are usable on desktop and mobile.
- [ ] Accessibility and keyboard behavior have been considered.
- [ ] Lint and production build pass.
- [ ] No secrets, private images, or generated build artifacts are committed.

## Commit messages

Use concise, imperative messages, for example:

- `Add polygon annotation tool`
- `Fix COCO export image identifiers`
- `Document local data retention`

## Reporting bugs

Include your browser and operating system, steps to reproduce, expected behavior, actual behavior, and a minimal example that does not expose private data.
