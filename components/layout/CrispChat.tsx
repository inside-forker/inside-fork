"use client";

import { useEffect } from "react";
import { useRole } from "@/lib/context/RoleContext";

// Crisp live-chat widget (support chat with an operator).
// Off entirely when NEXT_PUBLIC_CRISP_WEBSITE_ID is unset.
const CRISP_WEBSITE_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

// Remembers which signed-in user the Crisp session belongs to, so a
// logout or account switch starts a fresh conversation instead of
// leaking the previous user's chat history.
const SESSION_OWNER_KEY = "ik_crisp_user";

type CrispCommand = [string, string, unknown?];

declare global {
  interface Window {
    $crisp?: CrispCommand[];
    CRISP_WEBSITE_ID?: string;
  }
}

function crisp(...command: CrispCommand) {
  window.$crisp = window.$crisp || [];
  window.$crisp.push(command);
}

function readOwner(): string | null {
  try {
    return localStorage.getItem(SESSION_OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(userId: string | null) {
  try {
    if (userId) localStorage.setItem(SESSION_OWNER_KEY, userId);
    else localStorage.removeItem(SESSION_OWNER_KEY);
  } catch {
    // Storage blocked: worst case the session isn't reset on logout.
  }
}

function loadCrisp(websiteId: string) {
  if (document.getElementById("crisp-sdk")) return;
  window.$crisp = window.$crisp || [];
  window.CRISP_WEBSITE_ID = websiteId;
  const script = document.createElement("script");
  script.id = "crisp-sdk";
  script.src = "https://client.crisp.chat/l.js";
  script.async = true;
  document.head.appendChild(script);
}

interface CrispChatProps {
  /** Show the chat bubble on this route. Hidden (not unloaded) otherwise. */
  visible: boolean;
}

export function CrispChat({ visible }: CrispChatProps) {
  const { user, isLoading } = useRole();

  // Load lazily the first time a public page is shown; after that just
  // toggle visibility so client-side navigation doesn't reload the widget.
  useEffect(() => {
    if (!CRISP_WEBSITE_ID) return;
    if (visible) {
      loadCrisp(CRISP_WEBSITE_ID);
      crisp("do", "chat:show");
    } else if (window.$crisp) {
      crisp("do", "chat:close");
      crisp("do", "chat:hide");
    }
  }, [visible]);

  // Attach the signed-in user so operators see who they're talking to.
  // Depend on fields, not the object: RoleContext refetches on every focus.
  const userId = user?.id ?? null;
  const email = user?.email;
  const name = user?.full_name;
  const role = user?.role;

  useEffect(() => {
    if (!CRISP_WEBSITE_ID || isLoading || !window.$crisp) return;

    const owner = readOwner();
    if (owner && owner !== userId) {
      crisp("do", "session:reset");
    }
    writeOwner(userId);

    if (!userId) return;
    if (email) crisp("set", "user:email", [email]);
    crisp("set", "user:nickname", [
      name || email?.split("@")[0] || "Inside Karachi user",
    ]);
    crisp("set", "session:data", [
      [
        ["user_id", userId],
        ["role", role ?? ""],
      ],
    ]);
  }, [userId, email, name, role, isLoading, visible]);

  // Actively adjust mobile bottom offset so closed chat bubble floats above BottomNav
  useEffect(() => {
    if (typeof window === "undefined") return;

    const adjustCrispPosition = () => {
      const isMobile = window.innerWidth <= 768;
      const offset = isMobile
        ? "calc(5.5rem + env(safe-area-inset-bottom, 0px))"
        : "";

      const elements = document.querySelectorAll(
        ".crisp-client, #crisp-chatbox, .crisp-client > div, .crisp-client iframe, .crisp-client [data-full-view='false']",
      );
      elements.forEach((el) => {
        if (el instanceof HTMLElement) {
          if (isMobile) {
            el.style.setProperty("bottom", offset, "important");
          } else {
            el.style.removeProperty("bottom");
          }
        }
      });
    };

    adjustCrispPosition();
    const interval = setInterval(adjustCrispPosition, 1000);
    window.addEventListener("resize", adjustCrispPosition);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", adjustCrispPosition);
    };
  }, []);

  return null;
}
