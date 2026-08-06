/**
 * Read a text field out of a `FormData`.
 *
 * `FormData.get()` returns `string | File | null`, and `String(file)` yields
 * `"[object File]"` - a value that looks like a filled-in field, passes a
 * truthiness check, and reaches the API as nonsense. A crafted multipart body
 * is enough to trigger it, so this is an input-validation boundary rather than
 * a type-checker appeasement.
 */
export const textField = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
};
