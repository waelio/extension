/**
 * @waelio/extension — Pure utility functions
 *
 * These work identically to waelio-utils — pure JS, no Chrome APIs needed.
 * Re-exported here so extension code can import from one place.
 */

// ── Type Checkers ──

export const isArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

export const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === "function";

export const isNumber = (value: unknown): value is number =>
  typeof value === "number" && !Number.isNaN(value);

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isString = (value: unknown): value is string =>
  typeof value === "string";

export const isValid = (value: unknown): boolean =>
  isArray(value) || isObject(value) || isString(value) || isNumber(value);

// ── Strings ──

export function jsonToQueryString(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export function queryStringToJson(qs: string): Record<string, string> {
  const result: Record<string, string> = {};
  const cleaned = qs.startsWith("?") ? qs.slice(1) : qs;
  for (const pair of cleaned.split("&")) {
    const [key, value] = pair.split("=");
    if (key) result[decodeURIComponent(key)] = decodeURIComponent(value ?? "");
  }
  return result;
}

export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function camelToSnake(str: string, separator = "_"): string {
  return str.replace(/[A-Z]/g, (c) => `${separator}${c.toLowerCase()}`);
}

export function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

export function generateId(length = 16): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, length);
}

export function sniffId(obj: Record<string, unknown>): unknown {
  return obj.id ?? obj._id ?? obj.Id ?? obj.ID ?? null;
}

// ── Arrays ──

export function equals(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export function repeat<T>(fn: (index: number) => T, times: number): T[] {
  return Array.from({ length: times }, (_, i) => fn(i));
}

// ── Objects ──

export function deepClone<T>(value: T): T {
  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
  if (Array.isArray(value)) return value.map(deepClone) as unknown as T;
  if (isObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = deepClone(v);
    }
    return result as unknown as T;
  }
  return value;
}

export function get(obj: unknown, path: string, defaultValue?: unknown): unknown {
  const keys = path.replace(/\[(\d+)]/g, ".$1").split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return defaultValue;
    current = (current as Record<string, unknown>)[key];
  }
  return current ?? defaultValue;
}

export function omit<T extends Record<string, unknown>>(obj: T, keys: string[]): Partial<T> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

export function pick<T extends Record<string, unknown>>(obj: T, keys: string[]): Partial<T> {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (key in obj) {
      (result as Record<string, unknown>)[key] = obj[key];
    }
  }
  return result;
}

export function cleanResponse(response: unknown): unknown {
  if (!isObject(response)) return response;
  if ("data" in response) {
    const data = response.data;
    if (isObject(data) && "data" in data) return data.data;
    return data;
  }
  return response;
}

// ── Crypto (using crypto.subtle for hardware acceleration) ──

export async function encrypt(value: unknown, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(value));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(salt), "PBKDF2", false, ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encoded: string, salt: string): Promise<unknown> {
  const encoder = new TextEncoder();
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(salt), "PBKDF2", false, ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
  );
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

// ── Other ──

export async function to<T>(promise: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    const result = await promise;
    return [null, result];
  } catch (error) {
    return [error instanceof Error ? error : new Error(String(error)), null];
  }
}

// ── Math ──

export function fibonacci(n: number): number {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) { [a, b] = [b, a + b]; }
  return b;
}

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

export function sumOf(arr: number[]): number {
  return arr.reduce((sum, n) => sum + n, 0);
}
