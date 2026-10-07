import { NavPublic } from "@/components/NavPublic";
import { ResumeClient } from "./ResumeClient";

export const dynamic = "force-dynamic";

export default function ResumePage() { return <div className="min-h-screen"><NavPublic /><main className="mx-auto w-full max-w-xl px-4 sm:px-6 py-16"><ResumeClient /></main></div>; }
