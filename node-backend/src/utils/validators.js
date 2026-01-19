export function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}
