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
