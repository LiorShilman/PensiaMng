# Graph Report - .  (2026-07-12)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 751 nodes · 1439 edges · 41 communities (40 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f910470c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37

## God Nodes (most connected - your core abstractions)
1. `CalcTrace` - 23 edges
2. `compilerOptions` - 22 edges
3. `AiService` - 20 edges
4. `App()` - 18 edges
5. `compilerOptions` - 18 edges
6. `CalcEngineController` - 17 edges
7. `post()` - 16 edges
8. `PrismaService` - 16 edges
9. `react` - 15 edges
10. `compilerOptions` - 15 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --indirect_call--> `AppModule`  [INFERRED]
  server/src/main.ts → server/src/app.module.ts
- `NiOldAgeResult` --references--> `CalcTrace`  [EXTRACTED]
  server/src/calc-engine/national-insurance.ts → server/src/calc-engine/types.ts
- `NiSurvivorsResult` --references--> `CalcTrace`  [EXTRACTED]
  server/src/calc-engine/national-insurance.ts → server/src/calc-engine/types.ts
- `NiDisabilityResult` --references--> `CalcTrace`  [EXTRACTED]
  server/src/calc-engine/national-insurance.ts → server/src/calc-engine/types.ts
- `App()` --calls--> `calcHealthScore()`  [EXTRACTED]
  client/src/App.tsx → client/src/api.ts

## Import Cycles
- None detected.

## Communities (41 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (30): AiController, Body, Controller, Get, Post, Put, Req, UseGuards (+22 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (26): Global, AppController, Controller, Get, AppModule, Module, AppService, Injectable (+18 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (49): eslint, eslint-config-prettier, @eslint/eslintrc, @eslint/js, eslint-plugin-prettier, globals, jest, @nestjs/cli (+41 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (44): AnalyzeResult, AnnuityResult, AuthResult, AuthUser, Beneficiary, calcAnnuity(), calcHealthScore(), calcPortfolio() (+36 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (25): AuthedRequest, JwtAuthGuard, JwtPayload, Injectable, Get, TRACK_DEFS, TrackAllocation, TrackDef (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (32): calcFeeComparison(), clearSession(), FeeComparisonResult, getStoredUser(), MaritalStatus, PortfolioScenarioTotals, ProductType, TrackDef (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (32): js, json, **/*.(t|j)s, ts, author, description, jest, collectCoverageFrom (+24 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (29): dependencies, react, react-dom, devDependencies, oxlint, @types/node, @types/react, @types/react-dom (+21 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (23): calcNiDisability(), calcNiOldAge(), calcNiSurvivors(), NI_PARAMS_2025, NiDisabilityResult, NiOldAgeInput, NiOldAgeResult, NiParams (+15 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (25): @anthropic-ai/sdk, bcryptjs, @nestjs/common, @nestjs/config, @nestjs/core, @nestjs/jwt, @nestjs/platform-express, openai (+17 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (23): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+15 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (12): ANNUITY_CEILING_BY_YEAR, calcRightsFixation(), defaultParamsFor(), EXEMPTION_PCT_PERIODS, FixationScenario, PastGrant, RightsFixationInput, RightsFixationParams (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.19
Nodes (16): aggregate(), ANNUITY_TYPES, calcPortfolio(), calcProduct(), FEE_CAPS, round2(), basePortfolio, pension (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (17): AiPanel(), DEFAULT_MODEL, aiAnalyze(), AiModelInfo, AiProvider, AiSettingsView, AiUsageView, getAiModels() (+9 more)

### Community 16 - "Community 16"
Cohesion: 0.22
Nodes (11): AiToolDef, calcDecumulation(), DecumulationInput, DecumulationResult, round2(), calcJobExit(), JobExitInput, JobExitResult (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (13): calcFeeComparison(), FeeComparisonInput, FeeComparisonProductInput, FeeComparisonProductResult, FeeComparisonResult, MARKET_AVG_FEES, MarketFeeBenchmark, round2() (+5 more)

### Community 18 - "Community 18"
Cohesion: 0.17
Nodes (13): aiExtractReport(), calcDecumulation(), DecumulationResult, ExtractedProduct, ExtractReportResult, UnauthorizedError, Decumulation(), nis() (+5 more)

### Community 19 - "Community 19"
Cohesion: 0.24
Nodes (10): annuityFromBalance(), CalcEngineController, Body, Controller, Post, ScenariosInput, ScenariosResult, AnnuityInput (+2 more)

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (12): AiChat(), Props, SUGGESTIONS, TOOL_LABELS, UiMessage, AiMarkdown(), bold(), isSeparatorLine() (+4 more)

### Community 21 - "Community 21"
Cohesion: 0.24
Nodes (9): calcHealthScore(), CAPITAL_TYPES, HealthComponent, HealthGrade, HealthScoreInput, HealthScoreProductInput, HealthScoreResult, round1() (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (11): ClientProfile, HealthScoreResult, PortfolioProductInput, PortfolioResult, RetirementResult, ScenariosResult, esc(), mdToHtml() (+3 more)

### Community 23 - "Community 23"
Cohesion: 0.35
Nodes (3): AiToolsService, INSURANCE_ONLY, Injectable

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (9): DeathProductOutcome, clip(), FlowLink, fmt(), layoutColumn(), MoneyFlow(), Node, Props (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.38
Nodes (8): annualToMonthlyRate(), projectBalance(), round2(), runScenario(), baseInput, validateInput(), ProjectionInput, ProjectionScenario

### Community 26 - "Community 26"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 27 - "Community 27"
Cohesion: 0.39
Nodes (6): ageMonthsLabel(), calcRetirement(), femaleRetirementAgeMonths(), Gender, RetirementInput, RetirementResult

### Community 28 - "Community 28"
Cohesion: 0.33
Nodes (6): calcTaxBenefits(), round2(), TAX_PARAMS_2025, TaxBenefitsInput, TaxBenefitsResult, TaxParams

### Community 29 - "Community 29"
Cohesion: 0.36
Nodes (7): calcRightsFixation(), FixationFormInput, PastGrant, RightsFixationResult, nis(), Props, RightsFixation()

### Community 30 - "Community 30"
Cohesion: 0.36
Nodes (7): SeriesPoint, COLORS, FanChart(), fmtCompact(), fmtFull(), M, Props

### Community 31 - "Community 31"
Cohesion: 0.25
Nodes (7): dist, node_modules, **/*spec.ts, test, ./tsconfig.json, exclude, extends

### Community 32 - "Community 32"
Cohesion: 0.43
Nodes (5): calcSimulatedPension(), futureValue(), round2(), SimulatedPensionInput, SimulatedPensionResult

### Community 33 - "Community 33"
Cohesion: 0.43
Nodes (6): calcTaxBenefits(), TaxBenefitsResult, TaxFormInput, nis(), Props, TaxBenefits()

### Community 34 - "Community 34"
Cohesion: 0.47
Nodes (5): calcJobExit(), JobExitResult, JobExit(), nis(), Props

### Community 35 - "Community 35"
Cohesion: 0.47
Nodes (5): calcSimulatedPension(), SimulatedPensionResult, nis(), Props, SimulatedPension()

### Community 36 - "Community 36"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

## Knowledge Gaps
- **235 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+230 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `Community 1` to `Community 0`, `Community 16`, `Community 12`, `Community 4`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `AiService` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Community 2` to `Community 6`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _235 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06431372549019608 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._