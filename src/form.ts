/** `FormData.get` returns `string | File`. A File stringifies to garbage. */
export function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
