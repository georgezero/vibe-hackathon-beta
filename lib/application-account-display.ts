export interface AuthenticatedAccountDisplay {
  displayName: string;
  roles?: {
    isAdmin: boolean;
    isJudge: boolean;
  };
}

export function applicationHeaderAccount(input: {
  display_name: string;
  roles?: {
    isAdmin: boolean;
    isJudge: boolean;
  };
}): AuthenticatedAccountDisplay {
  return {
    displayName: input.display_name,
    ...(input.roles ? { roles: input.roles } : {}),
  };
}
