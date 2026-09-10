/**
 * Относительное время в стиле эталона: «9 секунд назад», «сейчас».
 * Язык берётся из настроек браузера, как в Studio.
 */
const rtfLocal = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
/** Память эталон подписывает по-английски независимо от языка браузера. */
const rtfEn = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(ts: number, locale?: "en"): string {
  const rtf = locale === "en" ? rtfEn : rtfLocal;
  if (!Number.isFinite(ts)) return "";
  const diff = Math.round((ts - Date.now()) / 1000);
  const abs = Math.abs(diff);
  if (abs < 5) return rtf.format(0, "second");
  if (abs < 60) return rtf.format(diff, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}
