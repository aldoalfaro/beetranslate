const HANGUL =
  /[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7AF\uD7B0-\uD7FF]/;

export function isHangul(char: string): boolean {
  return HANGUL.test(char);
}
