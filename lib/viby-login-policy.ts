export const VIBY_LOGIN_OPERATIONS = ["application_login", "admin_login", "judge_login"] as const;
export const VIBY_RUNTIME_CALLBACK_PATH = "/admin/viby/callback";
export const VIBY_RUNTIME_MODE = "admin" as const;
export const VIBY_RUNTIME_SOURCE = "vibe_admin_confirmation";

export type VibyLoginOperation = typeof VIBY_LOGIN_OPERATIONS[number];

export interface VibyLoginPolicy {
  operation: VibyLoginOperation;
  flow: "application" | "admin" | "judge";
  initiatingPath: "/login" | "/admin" | "/judge";
  callbackPath: string;
  entryPath: string;
  linkPath: string;
  defaultReturnTo: string;
  allowedReturnPrefix: string;
  allowedReturnPaths: readonly string[];
  runtimeMode: "admin";
  source: string;
  allowIdentityLinking: true;
  authorization: "none" | "admin" | "judge";
  auditNamespace: "application" | "admin" | "judge";
  auditEvents: {
    started: string;
    denied: string;
    linkStarted: string;
    linkSucceeded: string;
  };
  routineFreshnessRequired: boolean;
  rememberedLoginAllowed: boolean;
}

const policies: Record<VibyLoginOperation, VibyLoginPolicy> = {
  application_login: {
    operation: "application_login",
    flow: "application",
    initiatingPath: "/login",
    callbackPath: VIBY_RUNTIME_CALLBACK_PATH,
    entryPath: "/login",
    linkPath: "/login/link-viby",
    defaultReturnTo: "/login",
    allowedReturnPrefix: "/login",
    allowedReturnPaths: ["/account", "/admin", "/admin/dashboard", "/judge", "/judge/dashboard", "/projects/join"],
    runtimeMode: VIBY_RUNTIME_MODE,
    source: VIBY_RUNTIME_SOURCE,
    allowIdentityLinking: true,
    authorization: "none",
    auditNamespace: "application",
    auditEvents: {
      started: "application_viby_login_started",
      denied: "application_viby_login_denied",
      linkStarted: "application_viby_link_started",
      linkSucceeded: "application_viby_link_succeeded",
    },
    routineFreshnessRequired: true,
    rememberedLoginAllowed: false,
  },
  admin_login: {
    operation: "admin_login",
    flow: "admin",
    initiatingPath: "/admin",
    callbackPath: VIBY_RUNTIME_CALLBACK_PATH,
    entryPath: "/admin",
    linkPath: "/admin/link-viby",
    defaultReturnTo: "/admin/dashboard",
    allowedReturnPrefix: "/admin",
    allowedReturnPaths: ["/account"],
    runtimeMode: VIBY_RUNTIME_MODE,
    source: VIBY_RUNTIME_SOURCE,
    allowIdentityLinking: true,
    authorization: "admin",
    auditNamespace: "admin",
    auditEvents: {
      started: "viby_admin_assertion_received",
      denied: "viby_admin_assertion_denied",
      linkStarted: "viby_identity_link_pending_created",
      linkSucceeded: "viby_identity_link_confirmed",
    },
    routineFreshnessRequired: true,
    rememberedLoginAllowed: false,
  },
  judge_login: {
    operation: "judge_login",
    flow: "judge",
    initiatingPath: "/judge",
    callbackPath: VIBY_RUNTIME_CALLBACK_PATH,
    entryPath: "/judge",
    linkPath: "/judge/link-viby",
    defaultReturnTo: "/judge/dashboard",
    allowedReturnPrefix: "/judge",
    allowedReturnPaths: ["/account"],
    runtimeMode: VIBY_RUNTIME_MODE,
    source: VIBY_RUNTIME_SOURCE,
    allowIdentityLinking: true,
    authorization: "judge",
    auditNamespace: "judge",
    auditEvents: {
      started: "judge_viby_login_started",
      denied: "judge_viby_login_denied",
      linkStarted: "judge_viby_link_started",
      linkSucceeded: "judge_viby_link_succeeded",
    },
    routineFreshnessRequired: true,
    rememberedLoginAllowed: false,
  },
};

export function vibyLoginPolicy(operation: VibyLoginOperation): VibyLoginPolicy {
  return policies[operation];
}

export function safeVibyReturnTo(
  operation: VibyLoginOperation,
  value: string | null | undefined,
) {
  const policy = vibyLoginPolicy(operation);
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return policy.defaultReturnTo;
  }
  try {
    const parsed = new URL(value, "https://application.invalid");
    if (
      parsed.origin !== "https://application.invalid"
      || (
        parsed.pathname !== policy.allowedReturnPrefix
        && !parsed.pathname.startsWith(`${policy.allowedReturnPrefix}/`)
        && !policy.allowedReturnPaths.includes(parsed.pathname)
      )
    ) {
      return policy.defaultReturnTo;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return policy.defaultReturnTo;
  }
}

export function isVibyLoginOperation(value: unknown): value is VibyLoginOperation {
  return typeof value === "string"
    && (VIBY_LOGIN_OPERATIONS as readonly string[]).includes(value);
}
