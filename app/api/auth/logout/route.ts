import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";
import { PARCHI_CHANNEL_COOKIE } from "@/lib/parchi/channel";

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearSession(response);
  // Drop sticky Parchi-channel cookie so signed-out visitors get IK branding.
  response.cookies.set(PARCHI_CHANNEL_COOKIE, "", {
    httpOnly: false,
    path: "/",
    maxAge: 0,
  });
  return response;
}
