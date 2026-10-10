# BlindBatch identity brief

## Product identity

- **Need:** small grant and proposal juries need a public eligibility gate without letting early votes influence later jurors.
- **GenLayer role:** validators independently fetch the frozen rubric and proposal evidence, then agree on quote-bound admission decisions.
- **Human boundary:** an odd jury ranks only admitted proposals; every ranking is committed as a salted SHA-256 digest before any ballot can be revealed.
- **Deterministic outcome:** after reveal quorum, the contract calculates Borda scores and a stable tie-break by proposal ID.
- **Safety boundary:** the contract cannot prove off-chain juror independence or guarantee that the funded work will succeed.

## Interface difference matrix

| Dimension | BlindBatch | ClauseMirror | Existing generic pattern avoided |
|---|---|---|---|
| Metaphor | Physical jury room and sealed batch | Editorial manuscript desk | Analytics dashboard |
| Core object | Ranked tickets and sealed envelopes | Stitched bilingual passages | Generic cards and charts |
| Layout | Process rail → evidence batch → jury ring → ballot | Source/translation folios | Sidebar + content panel |
| Color | Deep navy, safety orange, electric lime | Warm paper and editorial red | Recolored template |
| Main interaction | Reorder, seal, save recovery ticket, reveal | Compare, revise, reviewer sign-off | Single AI evaluate button |
| Contract lifecycle | OPEN → COMMIT → REVEAL → FINAL | READY → ASSESSED → REVISION → FINAL | CRUD workflow |

## Mechanism difference

Consensus controls admission, not the final preference ranking. Human jurors choose the order, but cryptographic commitment prevents them from changing it after seeing another reveal. The contract validates jury membership, commitment uniqueness, canonical ranking membership, reveal preimages, quorum, and deterministic tallying.
