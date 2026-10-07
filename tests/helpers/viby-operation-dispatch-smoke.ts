export {};

async function main() {
  const {
    consumeVibyLoginTransaction,
    createVibyLoginTransaction,
    inspectVibyLoginTransactionState,
  } = await import("../../lib/viby-login-transactions");

  const admin = await createVibyLoginTransaction({
    operation: "admin_login",
    returnTo: "/admin/dashboard",
    expectedAudience: "vibe-hackathon",
    freshnessRequired: true,
  });
  const judge = await createVibyLoginTransaction({
    operation: "judge_login",
    returnTo: "/judge/dashboard",
    expectedAudience: "vibe-hackathon",
    freshnessRequired: true,
  });

  const adminInspection = await inspectVibyLoginTransactionState(admin.state);
  const judgeInspection = await inspectVibyLoginTransactionState(judge.state);
  const browserMismatch = await consumeVibyLoginTransaction({
    state: judge.state,
    browserBinding: admin.browserBinding,
  });
  const judgeConsumed = await consumeVibyLoginTransaction({
    state: judge.state,
    browserBinding: judge.browserBinding,
  });
  const judgeReplay = await consumeVibyLoginTransaction({
    state: judge.state,
    browserBinding: judge.browserBinding,
  });
  const adminConsumed = await consumeVibyLoginTransaction({
    state: admin.state,
    browserBinding: admin.browserBinding,
  });

  console.log(JSON.stringify({
    adminInspection,
    judgeInspection,
    browserMismatch: Boolean(browserMismatch),
    judgeOperation: judgeConsumed?.operation ?? null,
    judgeReturnTo: judgeConsumed?.returnTo ?? null,
    judgeReplay: Boolean(judgeReplay),
    adminOperation: adminConsumed?.operation ?? null,
    adminReturnTo: adminConsumed?.returnTo ?? null,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "operation dispatch test failed");
  process.exitCode = 1;
});
