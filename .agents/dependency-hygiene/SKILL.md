---
name: dependency-hygiene
description: Check project dependencies (npm/yarn/pnpm) for known vulnerabilities and outdated packages, and safely apply fixes without breaking the build. Use before a production deploy, periodically as maintenance, or when the user asks to check/update packages, run an audit, or fix vulnerable dependencies.
---

# Dependency Hygiene

A skill for keeping third-party dependencies secure and current without breaking the app.

## Workflow

1. **Audit**: run the package manager's audit command
   - npm: `npm audit`
   - yarn: `yarn audit`
   - pnpm: `pnpm audit`
2. **Categorize findings** by severity: Critical / High / Moderate / Low
3. **Check for available fixes**:
   - `npm audit fix` handles patch/minor-version fixes automatically and safely in most cases
   - Anything requiring a major version bump needs manual review — check the changelog for breaking changes before applying
4. **Apply safe fixes first** (patch/minor), then re-run the audit to confirm resolution
5. **For unfixable vulnerabilities** (no patched version exists yet):
   - Check if the vulnerable code path is actually reachable in this app's usage
   - Consider a temporary override/resolution pin if the maintainer confirms a fix is coming
   - Document the accepted risk if it must be deferred

## What to check beyond `npm audit`

- **Outdated packages** not yet flagged as vulnerable: `npm outdated` — staying current reduces future audit surprises
- **Unused dependencies**: packages installed but never imported — remove to reduce attack surface, not just for cleanliness
- **Duplicate/conflicting versions**: multiple versions of the same package pulled in transitively (`npm ls <package>`) can cause subtle bugs
- **License changes**: occasionally relevant for commercial projects — flag if a dependency changed to a restrictive license in a recent major version

## Safety rules

- Never run `npm audit fix --force` blindly — this can apply major version bumps and break the build. Review what it proposes first.
- After any dependency update, run the build and existing tests before considering the task done.
- For a production project, don't update everything in one pass — batch by severity (fix Critical/High immediately, batch Moderate/Low separately) so a breaking change is easy to isolate.
- Lockfile (`package-lock.json` / `yarn.lock` / `pnpm-lock.yaml`) should always be committed alongside dependency changes.

## Output format

Table: `Package | Current | Fixed Version | Severity | Breaking Change? | Action Taken`

Then list:
- What was fixed automatically
- What needs manual review (major bumps, no available fix)
- What should be retested after the changes (build, core user flows, anything touching the updated package directly)

## Frequency

For an actively developed project, run this check:
- Before every production deploy
- At minimum weekly during active development
- Immediately if a new CVE is publicly disclosed for a package you depend on
