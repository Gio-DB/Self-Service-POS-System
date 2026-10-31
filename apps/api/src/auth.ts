import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import type { Request } from "express";
import { HttpError } from "./errors.js";

export const staffRoles = ["WAITER", "KITCHEN", "ADMIN"] as const;
export type StaffRole = (typeof staffRoles)[number];

export type StaffAuthConfig = {
  sessionSecret: string;
  pins: Record<StaffRole, string>;
  sessionTtlMs: number;
};

export type StaffSession = {
  role: StaffRole;
  expiresAt: Date;
};

const sessionCookieName = "pos_staff_session";
const defaultSessionTtlHours = 8;
const staffPinHashBytes = 64;

function deriveStaffPinHash(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(pin, salt, staffPinHashBytes, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function requiredSetting(name: string, environment: NodeJS.ProcessEnv): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be configured before starting the API.`);
  }
  return value;
}

function bootstrapPinSetting(name: string, environment: NodeJS.ProcessEnv): string {
  return environment[name]?.trim() ?? "";
}

export function readStaffAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): StaffAuthConfig {
  const configuredHours = environment.STAFF_SESSION_TTL_HOURS;
  const sessionTtlHours = configuredHours
    ? Number(configuredHours)
    : defaultSessionTtlHours;
  if (!Number.isFinite(sessionTtlHours) || sessionTtlHours <= 0 || sessionTtlHours > 24) {
    throw new Error("STAFF_SESSION_TTL_HOURS must be a number from 0 to 24.");
  }

  return {
    sessionSecret: requiredSetting("STAFF_SESSION_SECRET", environment),
    pins: {
      WAITER: bootstrapPinSetting("STAFF_WAITER_PIN", environment),
      KITCHEN: bootstrapPinSetting("STAFF_KITCHEN_PIN", environment),
      ADMIN: bootstrapPinSetting("STAFF_ADMIN_PIN", environment),
    },
    sessionTtlMs: sessionTtlHours * 60 * 60 * 1_000,
  };
}

function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && staffRoles.includes(value as StaffRole);
}

function sign(value: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(value).digest();
}

export function createStaffSessionToken(
  role: StaffRole,
  config: StaffAuthConfig,
  now = Date.now(),
): string {
  const payload = Buffer.from(JSON.stringify({
    role,
    exp: now + config.sessionTtlMs,
  })).toString("base64url");
  return `${payload}.${sign(payload, config.sessionSecret).toString("base64url")}`;
}

export function readStaffSessionToken(
  token: string | undefined,
  config: StaffAuthConfig,
  now = Date.now(),
): StaffSession | null {
  if (!token) return null;
  const [payload, signature, extraPart] = token.split(".");
  if (!payload || !signature || extraPart) return null;

  let suppliedSignature: Buffer;
  let parsed: unknown;
  try {
    suppliedSignature = Buffer.from(signature, "base64url");
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const expectedSignature = sign(payload, config.sessionSecret);
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature) ||
    !parsed ||
    typeof parsed !== "object"
  ) {
    return null;
  }

  const { role, exp } = parsed as { role?: unknown; exp?: unknown };
  if (!isStaffRole(role) || typeof exp !== "number" || !Number.isFinite(exp) || exp <= now) {
    return null;
  }
  return { role, expiresAt: new Date(exp) };
}

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;
  return cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function getStaffSession(
  request: Request,
  config: StaffAuthConfig,
): StaffSession | null {
  return readStaffSessionToken(readCookie(request, sessionCookieName), config);
}

export function requireStaffRole(
  request: Request,
  config: StaffAuthConfig,
  ...roles: readonly StaffRole[]
): StaffSession {
  const session = getStaffSession(request, config);
  if (!session) {
    throw new HttpError(401, "Staff sign-in is required.");
  }
  if (!roles.includes(session.role)) {
    throw new HttpError(403, "Your staff role is not permitted to perform this action.");
  }
  return session;
}

export async function hashStaffPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await deriveStaffPinHash(pin, salt);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function staffPinHashMatches(
  suppliedPin: string,
  encodedHash: string,
): Promise<boolean> {
  const [algorithm, saltHex, hashHex, extra] = encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    !saltHex ||
    !hashHex ||
    extra !== undefined ||
    !/^[0-9a-f]{32}$/i.test(saltHex) ||
    !/^[0-9a-f]{128}$/i.test(hashHex)
  ) {
    return false;
  }
  const salt = Buffer.from(saltHex, "hex");
  const expectedHash = Buffer.from(hashHex, "hex");
  const suppliedHash = await deriveStaffPinHash(suppliedPin, salt);
  return timingSafeEqual(suppliedHash, expectedHash);
}

export function staffSessionCookieOptions(config: StaffAuthConfig) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: config.sessionTtlMs,
    path: "/",
  };
}

export const staffSessionCookie = sessionCookieName;
