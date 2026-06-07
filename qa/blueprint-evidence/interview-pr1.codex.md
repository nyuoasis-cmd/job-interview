# Codex 검토 증거 — job-interview (Phase 1: Plan)

## Round 2
```
# Codex Adversarial Review

Target: branch diff against 9802436
Verdict: needs-attention

No-ship: the plan still relies on a manual version-bump convention for evaluation criteria, so the main R1 reproducibility fix can silently fail.

Findings:
- [high] Criteria versioning is not enforceable, so mixed scoring definitions can be averaged as one version (docs/PLAN-interview-v1.md:63-75)
  ADR-5 and ADR-6 depend on `criteria_version` to keep dashboard aggregates reproducible, but the only protection against a changed `evaluation-criteria.json` reusing the same version is the human rule that file changes require a version bump. The stated runtime guard checks weight sum and item presence, not whether the criteria content changed under the same version. If an engineer edits weights, wording, thresholds, or criterion definitions without bumping `v1.0`, future attempts will be stored with the same `criteria_version` as older attempts and the dashboard filter will explicitly average incompatible evaluation facts together. This defeats the claimed immutable snapshot/reproducibility guarantee and is hard to detect after production data accumulates.
  Recommendation: Make criteria identity mechanically immutable: store a criteria content hash or full criteria snapshot on each attempt, and add CI/server boot checks that reject criteria file changes without a new version/hash. Dashboard grouping should use the immutable criteria identity, not only a manually maintained string.

Next steps:
- Add an explicit acceptance criterion and implementation requirement for criteria content hashing or stored criteria snapshots before PR3/PR5 can be approved.
```

## Round 3
```
# Codex Adversarial Review

Target: branch diff against 9802436
Verdict: needs-attention

No-ship: R3 still does not make criteria identity mechanically immutable enough for the aggregation invariant.

Findings:
- [critical] Truncated criteria hash can silently merge different scoring rubrics (docs/PLAN-interview-v1.md:64-67)
  ADR-6 makes `criteria_hash` the real identity for attempts and dashboard aggregation, but stores only an 8-hex-character SHA-256 prefix. That reduces the invariant to 32 bits. If two different `evaluation-criteria.json` contents share the same prefix, attempts scored under different rubrics will be averaged together with no warning, recreating the R2 failure mode as silent dashboard corruption. This is an inference from the plan text, but it is directly implied by using the same truncated value for persistence and grouping.
  Recommendation: Store and group by the full SHA-256 digest, or at minimum a collision-resistant length such as 128 bits plus a unique DB constraint/CI test proving distinct committed criteria fixtures cannot share an identity. Keep any 8-char value display-only.

Next steps:
- Revise ADR-6 so `criteria_hash` means the full digest in storage, CI comparison, and dashboard grouping.
- Optionally add a separate `criteria_hash_short` or UI formatter for display only.
```

## Round 4
```
# Codex Adversarial Review

Target: branch diff against 9802436
Verdict: needs-attention

No-ship: the plan now requires full 64-character SHA-256 for evaluation criteria storage and grouping, but it still leaves the completed-attempt snapshot mutable through the question bank.

Findings:
- [high] Attempt snapshots still depend on mutable question-bank content (docs/PLAN-interview-v1.md:55-62)
  ADR-5 claims immutable attempt snapshots for reproducible reports, but the stored snapshot only includes `assigned_question_ids[]`; it does not store the question text, question content hash, or dataset version/hash. If `questions-by-industry.json` is edited while IDs are reused, old attempts can be re-rendered or audited against new question text even though the attempt row appears immutable. This is an inference from the documented storage contract, but it directly violates the stated invariant that completed reports remain reproducible after content changes.
  Recommendation: Store immutable question content alongside each attempt, or add a full SHA-256 hash/version for every referenced question-bank snapshot and require report rendering/audit paths to resolve against that exact snapshot.

Next steps:
- Keep the full SHA-256 criteria hash requirement as written for ADR-6.
- Patch ADR-5 to make question content or question-bank hash part of the immutable attempt snapshot before shipping the plan.
```

## Round 5
```
# Codex Adversarial Review

Target: branch diff against 9802436
Verdict: approve

No ship-blocking residual defect is defensible from this docs-only branch diff. The R5 addition closes the prior R4 high at the plan level by requiring a full `questions_bank_hash` on each immutable attempt and forbidding current-bank rendering for historical reports.

No material findings.
```
