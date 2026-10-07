# Dependency Security

This document records the P0.3 dependency review and the supported dependency
graph selected on 2026-07-27. Audit output is a point-in-time signal, not proof
that a package is safe. Re-run the commands below before each release.

## Audit baseline and result

`npm audit` counts package labels: a single underlying advisory can appear
against several packages in one dependency path. “Distinct advisories” below
deduplicates the advisory source identifiers in the JSON output.

| Installation | Before P0.3 | Supported P0.3 graph |
| --- | --- | --- |
| Full | 15 package labels (11 high, 4 moderate), 24 distinct advisories | 17 package labels (12 high, 5 moderate), 6 distinct advisories |
| Production (`--omit=dev`) | 13 package labels (9 high, 4 moderate), 19 distinct advisories | 8 package labels (3 high, 5 moderate), 5 distinct advisories |

The number of package labels increased while the number of distinct advisories
fell because unsupported esbuild, PostCSS, and Sharp overrides were removed.
Those overrides made the audit output smaller by forcing versions outside
their parents’ declared ranges. A supported, reproducible graph takes priority
over suppressing advisory counts.

The production audit is not zero. P0.3 must not be treated as release-ready
until compatible upstream versions resolve the production paths described
below, or the affected packages are removed through a separately reviewed
change.

## Resolution table

| Package/path | Before | Final | Classification | Resolution | Parent-range status | Residual risk |
| --- | --- | --- | --- | --- | --- | --- |
| `next` | 16.2.6 | 16.2.12 | direct, runtime/server and browser framework | compatible patch update | direct exact version | Its exact PostCSS dependency and optional Sharp range remain affected |
| `better-auth` | 1.6.14 | 1.6.25 | direct, runtime/server | compatible patch update | direct `^1.6.25` | Audit labels it through optional peer paths; no independent Better Auth advisory remains |
| `@better-auth/drizzle-adapter` | 1.6.14 | 1.6.25 | direct, runtime/server | matching patch update | direct `^1.6.25`; matches core | No known independent advisory in the current audit |
| `kysely` | 0.28.8 | 0.28.17 | direct and Better Auth/Drizzle peer, runtime/server | direct pin plus compatible override | satisfies `^0.28.5`, `^0.28.17`, and unconstrained affected peer ranges | No advisory reported for the selected version |
| `drizzle-kit` | 0.31.10 | 0.31.10 | direct development/operator tool; devOptional logical path through Better Auth | reclassified from runtime to development | satisfies Better Auth peer `>=0.31.4` | Deprecated esbuild-kit loader retains esbuild 0.18.20 |
| `esbuild` under `@esbuild-kit/core-utils@3.3.2` | 0.18.20 | 0.18.20 | deprecated loader; development/devOptional | unsupported 0.25 override removed | satisfies parent `~0.18.20` | GHSA-67mh-4wv8-2f99; do not expose its development server to untrusted origins |
| `tsx` / top-level esbuild | 4.22.4 / older resolved version | 4.23.1 / 0.28.1 | direct development scripts | compatible patch update; esbuild declared directly to keep npm's devOptional peer graph valid | satisfies tsx `~0.28.0` and Vite `^0.27.0 || ^0.28.0`; Drizzle Kit keeps its own 0.25.12 satisfying `^0.25.4` | Separate from the deprecated loader path |
| `postcss` under Next | 8.4.31 | 8.4.31 | transitive runtime/build framework dependency | unsupported global override removed | exactly satisfies Next 16.2.12 | GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, and GHSA-r28c-9q8g-f849 |
| `postcss` under Tailwind/Vite | older resolved versions | 8.5.23 | development/build | natural compatible resolution | satisfies parent ranges | No advisory reported for this instance |
| `sharp` under Next | 0.34.3 | 0.34.5 | optional runtime/native image processing | compatible patch within Next range | satisfies Next `^0.34.5` | GHSA-f88m-g3jw-g9cj; no fixed 0.34.x exists |
| `js-yaml` | vulnerable 4.x | 4.3.0 | transitive development lint configuration parser | natural compatible resolution; override removed | satisfies ESLint range | No advisory reported |
| modern `brace-expansion` | vulnerable lines | 5.0.8 | transitive development lint globbing | narrow override under Minimatch 10.2.5 | satisfies `^5.0.5` | No advisory reported for this instance |
| legacy `brace-expansion` | vulnerable lines | 1.1.16 | transitive development lint globbing | narrow override under Minimatch 3.1.5 | satisfies `^1.1.7` | GHSA-mh99-v99m-4gvg remains; no fixed 1.x release |

`clsx` was removed after static, dynamic, script, and test usage searches found
no consumers. `@types/better-sqlite3` is type-only and moved to development.
`drizzle-kit` is used by schema/operator scripts and moved to development; it
is not imported by deployed application code.

## Remaining advisories

### Production-visible logical paths

- Next.js 16.2.12 declares PostCSS 8.4.31 exactly. The current audit reports
  three PostCSS advisories. A global 8.5.x override is not supported by that
  parent contract, even if a build happens to pass.
- Next.js 16.2.12 declares optional Sharp `^0.34.5`. Sharp 0.34.5 is the newest
  release in the accepted line, but the current audit reports
  GHSA-f88m-g3jw-g9cj for all versions below 0.35. Sharp 0.35 is a breaking
  release and is outside Next’s range.
- Better Auth declares Drizzle Kit as an optional peer. npm therefore retains a
  devOptional logical path during `npm ci --omit=dev`. Drizzle Kit’s deprecated
  `@esbuild-kit/esm-loader` depends on `@esbuild-kit/core-utils`, which requires
  esbuild `~0.18.20`. The current audit reports GHSA-67mh-4wv8-2f99 for that
  development-server behavior. Forcing esbuild 0.25 into this path is outside
  the parent range and makes the production-only graph invalid.

These dependencies are not used as application-controlled public development
servers. That limits exploitability for the esbuild finding but does not remove
the audit finding. PostCSS processes repository-controlled application CSS in
the normal build; do not add workflows that compile attacker-supplied CSS or
source maps. Sharp processes configured remote images at runtime, so its native
decoder advisory remains the most relevant residual runtime risk.

### ESLint / Minimatch / brace-expansion

The full audit also reports one distinct advisory,
GHSA-mh99-v99m-4gvg, through ESLint 9, Minimatch 3, and brace-expansion 1.
It appears as nine package labels in the full audit. This path is
development-only and processes repository-controlled lint globs. There is no
compatible fixed brace-expansion 1.x release. Forcing brace-expansion 5 changes
the legacy API contract, while ESLint 10 is a separate major toolchain
migration. Reconsider this accepted development risk when ESLint and its plugin
tree support a fixed dependency line.

## Retained overrides and lifecycle

| Override | Affected parent/range | Why retained | Remove or reconsider when |
| --- | --- | --- | --- |
| `kysely: 0.28.17` | Better Auth adapters and Drizzle peers accepting 0.28.x | Keeps every adapter on the first reviewed 0.28.x release containing the relevant query-builder fixes | All parents naturally resolve an equal or newer reviewed compatible release |
| `minimatch@10.2.5 > brace-expansion: 5.0.8` | Minimatch `^5.0.5` | Resolves the modern brace-expansion advisories without crossing a parent range | Minimatch pins or naturally resolves 5.0.8 or newer |
| `minimatch@3.1.5 > brace-expansion: 1.1.16` | Minimatch `^1.1.7` | Resolves the older uncontrolled-resource-consumption advisory while preserving the legacy contract | ESLint leaves Minimatch 3 or a fixed compatible 1.x line is published |

The removed esbuild, PostCSS, and Sharp overrides crossed parent contracts. The
removed js-yaml override became redundant because the regenerated graph
naturally selects 4.3.0.

## Installation and native behavior

The supported runtime is Node.js 20.9 or newer, matching Next.js 16.2.12.
Full and production-only installs must use the committed lockfile.

`npm ci --omit=dev` can still display devOptional or optional-peer packages in
the logical dependency tree. npm uses these records to describe peer
relationships even when a package was declared in `devDependencies`; this is
why the Better Auth → Drizzle Kit audit path can remain visible.
The direct development esbuild declaration gives tsx and the devOptional Vite
peer one shared in-range version, while Drizzle Kit retains its own in-range
0.25.12. Without the direct declaration, npm 10 omits Vitest's nested esbuild
during a production-only install and leaves Vite attached to Drizzle Kit's
incompatible 0.25.12.

Clean full and production-only installs both complete, preserve the manifest
and lockfile hashes, and make `npm ls --all` / `npm ls --omit=dev --all` exit
zero without `ELSPROBLEMS`, invalid, or missing required edges. On the tested
Linux arm64 host, npm 10 labels several hoisted WASM helpers as `extraneous`
because their optional `@img/sharp-wasm32` parent is correctly skipped for the
platform. Those helpers are present in the lockfile with integrity metadata and
do not make `npm ls` fail, but this npm optional-package bookkeeping means the
stricter “no displayed extraneous label” criterion is not met.

Lifecycle/native packages include:

- `better-sqlite3`, which selects a prebuilt native SQLite binding and can fall
  back to compilation through `node-gyp`;
- Sharp 0.34.5, whose install check selects optional platform packages and can
  fall back to a source build; its prebuilt Linux packages require glibc 2.26+
  or musl 1.2.2+;
- esbuild, Next SWC, and `unrs-resolver`, which select platform-specific native
  packages;
- platform packages for Sharp/libvips, SWC, esbuild, Rollup/Rolldown, and
  resolver bindings, which are optional in the lockfile and selected for the
  host at install time.

`prebuild-install`, invoked by `better-sqlite3`, is itself deprecated. Revisit
that native installation path when `better-sqlite3` adopts a maintained
replacement; changing native database packaging is outside P0.3.

Sharp’s source fallback requires an installed, globally discoverable libvips
at least as new as the version listed in Sharp’s `config.libvips`. CI must not
assume a developer cache contains the native artifact.

Deprecated transitive packages currently include
`@esbuild-kit/esm-loader` and `@esbuild-kit/core-utils`. Drizzle Kit 0.31.10
still declares the loader even though its current CLI also declares modern
`tsx`; do not claim a Drizzle CLI smoke test validates the deprecated loader.

Registry integrity hashes, signatures, and attestations are provenance signals
only. They do not establish package safety. Packages without attestations still
depend on the lockfile’s registry URL and integrity metadata (and registry
signature metadata where available).

## Reproduction

Use isolated directories and an empty cache. These commands do not run
`db:push`:

```bash
# Full installation
npm ci --cache /tmp/vibe-npm-cache-full
npm ls --all
npm audit
npm audit --omit=dev

# Production-only installation
npm ci --omit=dev --cache /tmp/vibe-npm-cache-production
npm ls --omit=dev --all
npm audit --omit=dev

# Application and focused consumers
npm test
npm run build
npx drizzle-kit check
npm run validate:presentation-rotation
```

For native smoke testing, exercise Sharp decode, resize, rotate, and PNG/JPEG/
WebP encoding, then call Next’s internal image optimizer with the same input.
For build tooling, compile the production Tailwind entry through PostCSS, parse
and merge a YAML fixture with js-yaml, and directly invoke the deprecated
esbuild-kit public transform API if that loader remains in the graph.

Do not run Playwright for this validation: its configured web server executes
`db:push`.
