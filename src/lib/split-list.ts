// Free-text list fields accept whatever separator the athlete reaches for:
// one per line, commas, or semicolons. Blank entries are dropped.
export function splitList(text: string): string[] {
  return text
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}
