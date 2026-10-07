import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userAccountControls } from "@/lib/db/schema";

export interface AccountControlState {
  status: "active" | "disabled";
  passwordChangeRequired: boolean;
  temporaryPasswordIssuedAt: Date | null;
  passwordChangedAt: Date | null;
  disabledAt: Date | null;
}

export type AccountControlResolution =
  | { status: "valid"; control: AccountControlState }
  | { status: "invalid" };

export const DEFAULT_ACCOUNT_CONTROL: AccountControlState = {
  status: "active",
  passwordChangeRequired: false,
  temporaryPasswordIssuedAt: null,
  passwordChangedAt: null,
  disabledAt: null,
};

function missingTable(error: unknown) {
  return error instanceof Error
    && /no such table.*user_account_controls/i.test(error.message);
}

export async function getAccountControlState(
  userId: string,
): Promise<AccountControlResolution> {
  try {
    const rows = await db.select({
      status: userAccountControls.status,
      passwordChangeRequired: userAccountControls.passwordChangeRequired,
      temporaryPasswordIssuedAt: userAccountControls.temporaryPasswordIssuedAt,
      passwordChangedAt: userAccountControls.passwordChangedAt,
      disabledAt: userAccountControls.disabledAt,
    }).from(userAccountControls)
      .where(eq(userAccountControls.userId, userId))
      .limit(2);
    if (rows.length === 0) {
      return { status: "valid", control: DEFAULT_ACCOUNT_CONTROL };
    }
    if (rows.length !== 1) return { status: "invalid" };
    const row = rows[0];
    const stateIsValid = (
      row.status === "active"
      && row.disabledAt === null
    ) || (
      row.status === "disabled"
      && row.disabledAt instanceof Date
    );
    if (!stateIsValid) return { status: "invalid" };
    return {
      status: "valid",
      control: {
        status: row.status,
        passwordChangeRequired: Boolean(row.passwordChangeRequired),
        temporaryPasswordIssuedAt: row.temporaryPasswordIssuedAt,
        passwordChangedAt: row.passwordChangedAt,
        disabledAt: row.disabledAt,
      },
    };
  } catch (error) {
    // B.4.5A is additive. The qualified pre-migration application behavior
    // remains active until the migration is deliberately applied.
    if (missingTable(error)) {
      return { status: "valid", control: DEFAULT_ACCOUNT_CONTROL };
    }
    throw error;
  }
}
