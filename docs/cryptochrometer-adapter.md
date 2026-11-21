# Blade 14 · offline Cryptochrometer adapter

This is an independent, bounded adaptation of the phase rules in attachment review 23, not a port of the original witness server. Its exact source and live Quantus observation endpoint have not been supplied. The recovered review names the profile and behavior but does not enumerate the original JSON field spelling. Accordingly the following **local normalized input shape** is explicit; upstream compatibility remains unverified until an actual export is supplied.

Required fields:
- `schema`: `NEXINUS_CRYPTOCHROMETER_OBSERVATION/v1`
- `source`: nonempty provenance label (untrusted, never an authority pin)
- `observedAt`: UTC ISO timestamp ending in `Z`
- `boundary`: `WG_SNAPSHOT_PROTOCOL_60S`
- `peers`: rows containing unique `id`, boolean `pinned`, and nonnegative `handshakeAgeSeconds` or `null`

Optional `phase` is the source's held phase (`DAY`, `TWILIGHT`, `NIGHT`) and is displayed independently. Optional `pinned` and `protocolReachable` summary counts must agree with the peer evidence at the observation time. No held phase, aggregate-only claim, signature-looking field, or source URL can authorize a fleet reading.

The pinned set is the denominator. Only pinned peers whose handshake age plus elapsed observation time is 0–60 seconds are protocol-reachable. Snapshot ages 0–30 seconds are usable; older or future observations are unavailable/rejected. DAY begins at 0.5, TWILIGHT at 0.25, NIGHT below 0.25 or without pins. Missing, unreadable and stale snapshot boundaries yield unavailable evidence rather than a healthy or unhealthy fleet claim.

The ratio feeds only the EARTH component of the seven-axis local projection. Missing evidence contributes no ambient magnitude and is visibly unavailable, not a measured zero. All results remain unsigned, with `OPERATOR EVIDENCE REQUIRED`. Import is memory-only; no ledger, signing keys, probe state, trust store or endpoint declaration is written. Blade 14 does not start fleet probes or fetch substrate samples. No network transport, witness pin, hysteresis reconstruction, signature verification, quorum or canonical fleet membership is claimed.

Provenance: `Quantus_attachment_gems_alignment_and_a_bounded_funding_opportunity.md`, Cryptochrometer section; `QUANTUS_Attachment_Detailed_Reviews.zip`, `attachment-reviews/23.md`. No source code was copied from the unlicensed/unavailable witness-server archive.