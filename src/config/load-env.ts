import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

let loaded = false;

/**
 * Loads a single `.env` file from the project root.
 * No `.env.local` / `.env.dev` / `.env.example` — everything lives in `.env`.
 */
export function loadEnvironment(): string {
  if (loaded) {
    return String(process.env.NODE_ENV || process.env.ENVIRONMENT || 'local').trim();
  }

  const root = process.cwd();
  const envPath = path.resolve(root, '.env');

  if (!fs.existsSync(envPath)) {
    throw new Error('Missing .env — create .env in the project root with all required keys');
  }

  dotenv.config({ path: envPath });

  const envName = String(process.env.NODE_ENV || process.env.ENVIRONMENT || '').trim();
  if (!envName) {
    throw new Error('Missing NODE_ENV (or ENVIRONMENT) in .env');
  }

  if (!process.env.ENVIRONMENT || String(process.env.ENVIRONMENT).trim() === '') {
    process.env.ENVIRONMENT = envName;
  }

  loaded = true;
  return envName;
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (value == null || String(value).trim() === '') {
    throw new Error(`Missing required env: ${key}`);
  }
  return String(value).trim();
}

/** Use env value when set; otherwise fallback (for optional keys like APP_HOST). */
export function envOr(key: string, fallback: string): string {
  const value = process.env[key];
  if (value == null || String(value).trim() === '') return fallback;
  return String(value).trim();
}

export function requireEnvNumber(key: string): number {
  const raw = requireEnv(key);
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Env ${key} must be a number, got: ${raw}`);
  }
  return n;
}

/** `true` / `false` (case-insensitive) from `.env`. */
export function requireEnvBool(key: string): boolean {
  const raw = requireEnv(key).toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`Env ${key} must be true or false, got: ${raw}`);
}

/** Comma-separated list from `.env`. */
export function requireEnvList(key: string): string[] {
  return requireEnv(key)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
