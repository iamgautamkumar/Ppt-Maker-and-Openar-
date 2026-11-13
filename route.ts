import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createUserSession,
  DEMO_USER_ID,
  ensureDemoDataSeeded,
  formatUserProfile,
  setAuthCookies,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await ensureDemoDataSeeded();
    const body = await request.json();

    if (body.demo === true) {
      const [demoUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, DEMO_USER_ID))
        .limit(1);

      if (!demoUser) {
        return NextResponse.json(
          { error: "Demo account unavailable" },
          { status: 404 }
        );
      }

      const token = await createUserSession(demoUser.id);
      await setAuthCookies(token);
      return NextResponse.json({ user: formatUserProfile(demoUser) });
    }

    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const [found] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!found || !verifyPassword(password, found.passwordHash)) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const token = await createUserSession(found.id);
    await setAuthCookies(token);

    return NextResponse.json({ user: formatUserProfile(found) });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json(
      { error: "Authentication failed." },
      { status: 500 }
    );
  }
}
