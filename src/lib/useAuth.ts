import { useEffect, useState } from "react";
import { getUser, handleAuthCallback, onAuthChange, type User } from "@netlify/identity";

export type AuthNotice = { tone: "ok" | "err"; text: string } | null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<AuthNotice>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Processes email confirmation / recovery / OAuth links that land with a hash token.
      try {
        const result = await handleAuthCallback();
        if (result?.type === "confirmation") setNotice({ tone: "ok", text: "Email confirmed — you're signed in." });
        if (result?.type === "recovery") setNotice({ tone: "ok", text: "Signed in via recovery link. Update your password from your account." });
      } catch (err) {
        setNotice({ tone: "err", text: err instanceof Error ? err.message : "Sign-in link failed." });
      }
      const u = await getUser();
      if (!cancelled) {
        setUser(u);
        setReady(true);
      }
    })();
    const unsub = onAuthChange((_event, u) => setUser(u));
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { user, ready, notice, setNotice };
}
