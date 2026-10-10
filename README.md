# BlindBatch

BlindBatch combines validator-audited eligibility screening with a sealed commit/reveal jury ranking. It is designed for small grant rounds, fellowships, and proposal selections where public minimum requirements should be checked consistently and jurors should not copy early votes.

## Lifecycle

1. An owner creates a round with one public rubric, two to six public proposal pages, and an odd jury of three, five, or seven independent addresses.
2. GenLayer validators freeze every page and produce one quote-bound check for every mandatory rubric gate on every proposal; the contract derives the overall decision.
3. Only admitted proposals enter the ballot. Every juror commits a SHA-256 digest of the round ID, complete ranking, and private salt.
4. The reveal chamber opens only after every juror has committed.
5. A strict majority reveal their exact rankings and salts. The contract verifies every preimage and calculates a deterministic Borda ranking.

## Why consensus matters

Eligibility requirements live in prose and proposals express the same facts differently. Validators independently compare the complete frozen rubric and proposal pages. They reject skipped mandatory gates, changed proposal identities, false admissions, fabricated quotations, or equivalent-looking outputs supported by different evidence.

## Recovery rule

The private salt and exact ranking are required to reveal a ballot. The frontend creates a recovery ticket for the juror to save before leaving. Secrets are never written to contract state during the commit phase.

## Safety boundary

BlindBatch proves what public pages validators evaluated, which jurors committed, which ballots were validly revealed, and how the final tally was derived. It cannot prove jurors did not coordinate off-chain, establish the truth of every applicant claim, or guarantee project impact.

The rubric and proposals under `docs/demo-*.txt` are operator-created smoke-test fixtures, not an independent funding round.

## Run locally

```bash
python -m pytest tests -q
genvm-lint lint contracts/blind_batch.py --json
cd frontend
npm ci
npm test
npm run build
```

The frontend targets GenLayer Studio Next, chain `61997`. Copy `frontend/.env.example` to `frontend/.env` and set `VITE_CONTRACT_ADDRESS` after deployment.

## Verified Studio Next deployment

- App: [blind-batch.pages.dev](https://blind-batch.pages.dev)
- Contract: [`0xa54f...0F41`](https://explorer-studio-dev.genlayer.com/address/0xa54f3AD3dDfCce094DD3bC2144070e5a7A6d0F41)
- Deployment: [`0xf25d...67e3`](https://explorer-studio-dev.genlayer.com/tx/0xf25dd253357ab44a4c4f9a457ae5d930d2fb7bd260e5b1b217273263ea4067e3)
- Live round creation: [`0xada0...95ab`](https://explorer-studio-dev.genlayer.com/tx/0xada08b3df79820110257d68c7f87121da4d2ee776e06aa25bd1e95a8abca95ab)
- Validator screening: [`0xd31c...9e5d`](https://explorer-studio-dev.genlayer.com/tx/0xd31c81a83d929549c2aaf26b46384a01dbef14eb5a2bd0f7ba68befc5e199e5d), finalized in `COMMIT` with both proposals admitted
- Deployed and repository source SHA-256: `4ccfb93929a0342dded6aa5ff10c5d3d1693cd71e31fddf467322bd7ada98868`

The complete machine-readable record is in `deployment.json`.
