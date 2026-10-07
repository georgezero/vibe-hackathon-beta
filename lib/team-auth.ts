import { headers } from "next/headers";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";

type Account = InferSelectModel<typeof accounts>;

export interface TeamSessionUser {
  id: string;
  email: string;
  githubId: string | null;
  githubUsername: string | null;
  name: string | null;
  image: string | null;
}

export async function getTeamSessionUser(): Promise<TeamSessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user) return null;
  const accountRows: Account[] = await db.select().from(accounts).where(eq(accounts.userId, user.id));
  const github = accountRows.find((account: Account) => account.providerId === "github");
  return {
    id: user.id,
    email: user.email,
    githubId: github?.accountId ?? null,
    githubUsername: user.name ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
  };
}

export function githubOAuthConfigured() {
  return Boolean(process.env.BETTER_AUTH_SECRET && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}
