import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

let loadedEnvName: string | null = null;

/**
 * `.env` is the switcher only (`NODE_ENV=local` | `dev` | …).
 * Then loads the matching file: `.env.local`, `.env.dev`, etc.
 * App code reads variables from that second file (via process.env).
 */
export function loadEnvironment(): string {
  if (loadedEnvName) return loadedEnvName;

  const root = process.cwd();
  const selectorPath = path.resolve(root, '.env');

  if (!fs.existsSync(selectorPath)) {
    throw new Error('Missing .env — set NODE_ENV=local (loads .env.local)');
  }

  dotenv.config({ path: selectorPath });

  const raw = process.env.NODE_ENV;
  if (raw == null || String(raw).trim() === '') {
    throw new Error('Missing NODE_ENV in .env — use local or dev');
  }

  const envName = String(raw).trim().toLowerCase();
  const allowed = new Set(['local', 'dev', 'development', 'production', 'prod', 'test']);
  if (!allowed.has(envName)) {
    throw new Error(
      `Unsupported NODE_ENV="${envName}" in .env — use local or dev (file: .env.${envName})`,
    );
  }

  const fileKey =
    envName === 'development' ? 'dev' : envName === 'production' ? 'prod' : envName;

  const targetPath = path.resolve(root, `.env.${fileKey}`);
  if (!fs.existsSync(targetPath)) {
    throw new Error(
      `Env file not found: .env.${fileKey} (from NODE_ENV=${envName} in .env)`,
    );
  }

  // Load target env and override selector values
  dotenv.config({ path: targetPath, override: true });

  process.env.NODE_ENV = envName;
  if (!process.env.ENVIRONMENT || String(process.env.ENVIRONMENT).trim() === '') {
    process.env.ENVIRONMENT = fileKey;
  }

  loadedEnvName = envName;
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

/** `true` / `false` (case-insensitive) from env. */
export function requireEnvBool(key: string): boolean {
  const raw = requireEnv(key).toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`Env ${key} must be true or false, got: ${raw}`);
}

/** Comma-separated list from env. */
export function requireEnvList(key: string): string[] {
  return requireEnv(key)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
