import "dotenv/config";

import {
  formatSimulationSummary,
  parseCliArgs,
  simulateSlackEvent,
} from "./simulate-slack-event.lib";

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim();

  if (!signingSecret) {
    console.error(
      "SLACK_SIGNING_SECRET is not set. Copy .env.example to .env and restart.",
    );
    process.exit(1);
  }

  const result = await simulateSlackEvent({
    options,
    signingSecret,
  });

  console.log(formatSimulationSummary(result));

  if (result.responseStatus < 200 || result.responseStatus >= 300) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Slack event simulation failed",
  );
  process.exit(1);
});
