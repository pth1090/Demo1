# CLAUDE.md

This file provides guidance to AI assistants (Claude and others) working in this repository. Update it as the project evolves.

---

## Repository Overview

- **Repo**: pth1090/demo1
- **Status**: Newly initialized — no source code exists yet.
- **Primary branch**: `main` (no commits yet at time of writing)

> When the first meaningful code is added, update this section with: project purpose, primary language/framework, and the problem it solves.

---

## Repository Structure

```
Demo1/
└── CLAUDE.md          # This file — AI assistant guidance
```

Update this tree as directories and files are added.

---

## Development Workflow

### Branch Naming

Feature branches follow the pattern `claude/<description>-<id>` (e.g., `claude/add-claude-documentation-KtLGs`). Use kebab-case descriptive names.

### Git Practices

- Commit early and often with clear, descriptive messages.
- Prefer small, focused commits over large all-in-one commits.
- Always push to the feature branch, never directly to `main` without a PR.
- Use `git push -u origin <branch-name>` for first push of a branch.

### Commit Message Style

```
<type>: <short imperative summary>

<optional body explaining why, not what>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

---

## Code Conventions

> This section should be filled in once a language/framework is chosen. Document:
> - Formatting tool and config (e.g., Prettier, Black, gofmt)
> - Linter and rules (e.g., ESLint, Ruff, Clippy)
> - Naming conventions (variables, files, functions)
> - Import ordering
> - Error handling patterns

---

## Testing

> Fill in once a test framework is set up. Document:
> - Test runner and command (e.g., `npm test`, `pytest`, `go test ./...`)
> - Where tests live relative to source (e.g., `__tests__/`, `*.test.ts`, `_test.go`)
> - Required coverage thresholds
> - How to run a single test vs. the full suite

---

## Build & Run

> Fill in once a build system is configured. Document:
> - Install dependencies command
> - Build command
> - Start / dev server command
> - Environment variables required (reference `.env.example`, never commit secrets)

---

## Key Conventions for AI Assistants

1. **Read before editing.** Always read a file before modifying it.
2. **No speculative abstractions.** Only add complexity the current task actually requires.
3. **No unrequested features.** Implement exactly what is asked — no more.
4. **No unnecessary files.** Prefer editing existing files over creating new ones.
5. **Security first.** Never introduce SQL injection, XSS, command injection, or other OWASP Top 10 vulnerabilities.
6. **No secrets in commits.** Never commit `.env` files, credentials, or API keys.
7. **Confirm before destructive actions.** Ask before force-pushing, deleting branches, or dropping data.
8. **Keep this file current.** Update CLAUDE.md whenever the project structure, commands, or conventions change significantly.

---

## GitHub Integration

- **MCP tool scope**: restricted to `pth1090/demo1` only.
- Do **not** create a pull request unless explicitly asked.
- Do **not** push to branches other than the one designated for the current task.

---

*Last updated: 2026-04-11 — initial creation (empty repository)*
