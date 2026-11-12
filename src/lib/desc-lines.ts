/**
 * A line's details as separate points. Package lines are saved one point per line
 * ("Gaye Holud + Wedding", "1 Photographer", …); older ones were joined with " — " and " · ".
 */
export function descLines(desc?: string | null): string[] {
  if (!desc) return [];
  return desc
    .split(/\r?\n/)
    .flatMap(l => l.split(" — "))
    .flatMap(l => l.split(" · "))
    .map(s => s.trim())
    .filter(Boolean);
}
