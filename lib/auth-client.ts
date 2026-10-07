"use client";

import { createAuthClient } from "better-auth/react";

// Authentication is same-origin. Omitting a client base URL lets Better Auth
// derive the active deployment origin instead of baking a build-time host into
// the browser bundle.
export const authClient = createAuthClient();
