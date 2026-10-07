import { NavPublic } from "@/components/NavPublic";
import { ClaimClient } from "./ClaimClient";

export const dynamic = "force-dynamic";

export default function ClaimPage() {
  return <div className="min-h-screen"><NavPublic /><main className="mx-auto w-full max-w-xl px-4 sm:px-6 py-16"><ClaimClient /></main></div>;
}
