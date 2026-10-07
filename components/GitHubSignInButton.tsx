"use client";

import { authClient } from "@/lib/auth-client";

export function GitHubSignInButton({ callbackURL }: { callbackURL: string }) {
  return (
    <button
      type="button"
      className="btn-primary"
      style={{ justifyContent: "center" }}
      onClick={() => {
        void authClient.signIn.social({ provider: "github", callbackURL });
      }}
    >
      Continue with GitHub
    </button>
  );
}
