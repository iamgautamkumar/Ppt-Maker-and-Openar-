import crypto from "crypto";
import { cookies } from "next/headers";
import { eq, gt, and } from "drizzle-orm";
import { db } from "@/db";
import { folders, presentations, sessions, templates, users } from "@/db/schema";
import { buildDemoSeedBundle } from "./seedData";
import { UserProfile } from "./types";

export const SESSION_COOKIE = "shiksha_session_token";
export const LOGGED_OUT_COOKIE = "shiksha_logged_out";
export const DEMO_USER_ID = "user_demo_aarav_sharma";
export const DEMO_USER_EMAIL = "aarav.sharma@shikshaslide.edu";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

let seedPromise: Promise<void> | null = null;

export async function ensureDemoDataSeeded(): Promise<void> {
  if (seedPromise) {
    return seedPromise;
  }
  seedPromise = (async () => {
    try {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.id, DEMO_USER_ID))
        .limit(1);

      if (existing.length === 0) {
        await db
          .insert(users)
          .values({
            id: DEMO_USER_ID,
            name: "Prof. Aarav Sharma",
            email: DEMO_USER_EMAIL,
            passwordHash: hashPassword("teacher123"),
            institution: "Sankalp Live Academy",
            subjectSpecialty: "Physics, CS & Bilingual Pedagogy",
            avatarColor: "#4F46E5",
            preferredMode: "light",
          })
          .onConflictDoNothing();
      }

      const existingDecks = await db
        .select({ id: presentations.id })
        .from(presentations)
        .where(eq(presentations.userId, DEMO_USER_ID))
        .limit(1);

      if (existingDecks.length === 0) {
        const bundle = buildDemoSeedBundle(DEMO_USER_ID);
        for (const f of bundle.folders) {
          await db.insert(folders).values(f).onConflictDoNothing();
        }
        for (const p of bundle.presentations) {
          await db.insert(presentations).values(p).onConflictDoNothing();
        }
        for (const t of bundle.templates) {
          await db.insert(templates).values(t).onConflictDoNothing();
        }
      }
    } catch (err) {
      seedPromise = null;
      throw err;
    }
  })();

  return seedPromise;
}

export async function createUserSession(userId: string): Promise<string> {
  const token = `sess_${crypto.randomBytes(24).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    id: token,
    userId,
    expiresAt,
  });
  return token;
}

export async function setAuthCookies(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  cookieStore.delete(LOGGED_OUT_COOKIE);
}

export function formatUserProfile(row: typeof users.$inferSelect): UserProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    institution: row.institution || "Online Academy",
    subjectSpecialty: row.subjectSpecialty || "Online Educator",
    avatarColor: row.avatarColor || "#4F46E5",
    preferredMode: row.preferredMode === "dark" ? "dark" : "light",
  };
}

export async function getAuthenticatedUser(options?: {
  allowAutoDemoOnFirstVisit?: boolean;
}): Promise<UserProfile | null> {
  await ensureDemoDataSeeded();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const now = new Date();
    const foundSessions = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, token), gt(sessions.expiresAt, now)))
      .limit(1);

    if (foundSessions.length > 0) {
      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.id, foundSessions[0].userId))
        .limit(1);
      if (userRows.length > 0) {
        return formatUserProfile(userRows[0]);
      }
    }
  }

  // If visitor has not explicitly logged out, allow demo educator profile on first load
  // so the workspace feels alive immediately while retaining full auth controls.
  const explicitlyLoggedOut = cookieStore.get(LOGGED_OUT_COOKIE)?.value === "1";
  if (options?.allowAutoDemoOnFirstVisit && !explicitlyLoggedOut) {
    const demoRows = await db
      .select()
      .from(users)
      .where(eq(users.id, DEMO_USER_ID))
      .limit(1);
    if (demoRows.length > 0) {
      return formatUserProfile(demoRows[0]);
    }
  }

  return null;
}

export async function requireRequestUser(): Promise<UserProfile | null> {
  return getAuthenticatedUser({ allowAutoDemoOnFirstVisit: true });
}
