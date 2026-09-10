/** Copies to the clipboard. In an insecure context the API is missing — then nothing happens. */
export function copyText(text: string): void {
  void navigator.clipboard?.writeText(text);
}
