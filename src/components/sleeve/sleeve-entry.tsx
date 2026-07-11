"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { sleeveApi } from "./client-api";
import { demoWorkspace } from "./demo-data";
import { LoginScreen } from "./login-screen";
import { SleeveWorkspace } from "./sleeve-workspace";
import type { SessionUser, WorkspaceData } from "./types";

const emptyWorkspace: WorkspaceData = { people: [], records: [], reminders: [] };

interface SleeveEntryProps {
  allowDemo: boolean;
}

export function SleeveEntry({ allowDemo }: SleeveEntryProps) {
  const [state, setState] = useState<"checking" | "signed-out" | "signed-in">("checking");
  const [user, setUser] = useState<SessionUser>({});
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let active = true;
    sleeveApi.session()
      .then((session) => {
        if (!active) return;
        if (session.authenticated) {
          setUser(session.user ?? {});
          setState("signed-in");
        } else {
          setState("signed-out");
        }
      })
      .catch(() => {
        if (active) setState("signed-out");
      });
    return () => { active = false; };
  }, []);

  async function signOut() {
    if (!isDemo) await sleeveApi.logout().catch(() => undefined);
    setIsDemo(false);
    setUser({});
    setState("signed-out");
  }

  if (state === "checking") {
    return (
      <main className="session-check" aria-live="polite">
        <span className="wordmark__mark" aria-hidden="true"><span /></span>
        <strong>Sleeve</strong>
        <p><ShieldCheck size={16} aria-hidden="true" />Checking your private session…</p>
      </main>
    );
  }

  if (state === "signed-out") {
    return (
      <LoginScreen
        allowDemo={allowDemo}
        onAuthenticated={(nextUser) => { setUser(nextUser); setIsDemo(false); setState("signed-in"); }}
        onPreview={() => { setUser({ email: "local-preview@sleeve.invalid" }); setIsDemo(true); setState("signed-in"); }}
      />
    );
  }

  return <SleeveWorkspace data={isDemo ? demoWorkspace : emptyWorkspace} user={user} isDemo={isDemo} onSignOut={signOut} />;
}

