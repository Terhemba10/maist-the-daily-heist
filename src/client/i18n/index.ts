import { en, type StringKey } from './en.ts';

export type { StringKey };

/** Look up a string and fill `{name}` placeholders. */
export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

export function hasKey(key: string): key is StringKey {
  return key in en;
}
