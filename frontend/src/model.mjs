export const clean = value => value instanceof Map
  ? Object.fromEntries([...value].map(([key, item]) => [key, clean(item)]))
  : Array.isArray(value) ? value.map(clean)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]))
  : typeof value === "bigint" ? Number(value) : value;
export const short = value => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "";
export const commitmentPayload = (roundId, ranking, salt) => `${roundId}|${ranking.join(",")}|${salt}`;
export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
export function moveRanking(items, index, offset) {
  const target = index + offset;
  if (target < 0 || target >= items.length) return [...items];
  const out = [...items];
  [out[index], out[target]] = [out[target], out[index]];
  return out;
}
export const phaseCopy = status => ({ OPEN: "Validator screening", COMMIT: "Ballots are sealed", REVEAL: "Reveal chamber open", FINAL: "Ranking certified" }[status] || "Round unavailable");

export const recoveryStorageKey = (chainId, contract, roundId, wallet) =>
  `blindbatch:recovery:${chainId}:${contract.toLowerCase()}:${roundId}:${wallet.toLowerCase()}`;

export function parseRecoveryTicket(raw, expectedRoundId, admitted) {
  const ticket = JSON.parse(raw);
  if (ticket?.round_id !== expectedRoundId) throw new Error("Recovery ticket belongs to a different round.");
  if (!Array.isArray(ticket.ranking) || ticket.ranking.length !== admitted.length) throw new Error("Recovery ranking is incomplete.");
  const expected = [...admitted].sort();
  const received = [...ticket.ranking].sort();
  if (new Set(ticket.ranking).size !== ticket.ranking.length || expected.some((id, index) => id !== received[index])) throw new Error("Recovery ranking does not match the admitted batch.");
  if (typeof ticket.salt !== "string" || ticket.salt.length < 16) throw new Error("Recovery salt is invalid.");
  if (typeof ticket.commitment !== "string" || !/^[0-9a-f]{64}$/i.test(ticket.commitment)) throw new Error("Recovery commitment is invalid.");
  return { round_id: ticket.round_id, ranking: [...ticket.ranking], salt: ticket.salt, commitment: ticket.commitment.toLowerCase() };
}
