export type ClassValue = string | false | null | undefined | 0;

/** Joins class names: falsy values are skipped so conditional classes read without `|| ''` ternaries. */
export const cx = (...parts: ClassValue[]): string => parts.filter(Boolean).join(" ");
