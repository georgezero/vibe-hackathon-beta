export {};

async function main() {
  const {
    createVibyLoginTransaction,
    consumeVibyLoginTransaction,
    safeAdminReturnTo,
  } = await import("../../lib/viby-login-transactions");
  const issued = await createVibyLoginTransaction({
    returnTo: "//attacker.example/path",
    expectedAudience: "vibe-hackathon",
    freshnessRequired: true,
  });
  const wrong = await consumeVibyLoginTransaction({
    state: `${issued.state}wrong`,
    browserBinding: issued.browserBinding,
  });
  const consumed = await consumeVibyLoginTransaction({
    state: issued.state,
    browserBinding: issued.browserBinding,
  });
  const replay = await consumeVibyLoginTransaction({
    state: issued.state,
    browserBinding: issued.browserBinding,
  });
  console.log(JSON.stringify({
    stateLength: issued.state.length,
    safeReturn: issued.transaction.returnTo,
    explicitSafeReturn: safeAdminReturnTo("/admin/dashboard?tab=overview"),
    wrongAccepted: Boolean(wrong),
    consumed: Boolean(consumed),
    replayAccepted: Boolean(replay),
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "transaction test failed");
  process.exitCode = 1;
});
