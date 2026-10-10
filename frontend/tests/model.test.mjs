import test from "node:test";
import assert from "node:assert/strict";
import { commitmentPayload, moveRanking, phaseCopy, sha256Hex } from "../src/model.mjs";

test("commitment payload matches contract canonical format", async () => {
  const payload = commitmentPayload("round-one", ["alpha", "beta"], "sixteen-byte-secret");
  assert.equal(payload, "round-one|alpha,beta|sixteen-byte-secret");
  assert.equal(await sha256Hex(payload), "e5dcce15650c0710daa775cf3a846ea251a570598e58e4b836115f6b44087615");
});

test("ranking movement is bounded and immutable", () => {
  const ranking = ["a", "b", "c"];
  assert.deepEqual(moveRanking(ranking, 1, -1), ["b", "a", "c"]);
  assert.deepEqual(moveRanking(ranking, 0, -1), ranking);
  assert.notEqual(moveRanking(ranking, 0, -1), ranking);
});

test("phase labels explain state", () => assert.equal(phaseCopy("REVEAL"), "Reveal chamber open"));
