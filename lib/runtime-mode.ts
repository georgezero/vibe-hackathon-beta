export type RuntimeMode = "development" | "test" | "production" | "unknown";

export function getRuntimeMode(value = process.env.NODE_ENV): RuntimeMode {
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }
  return "unknown";
}

export function isExplicitDevelopmentRuntime() {
  return getRuntimeMode() === "development";
}

export function isProductionSafeRuntime() {
  return !isExplicitDevelopmentRuntime();
}
