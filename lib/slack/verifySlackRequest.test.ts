import crypto from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifySlackRequest } from "./verifySlackRequest";

const SIGNING_SECRET = "test-signing-secret";

function signSlackRequest(rawBody: string, timestamp: string, secret = SIGNING_SECRET) {
  return `v0=${crypto
    .createHmac("sha256", secret)
    .update(`v0:${timestamp}:${rawBody}`, "utf8")
    .digest("hex")}`;
}

function currentTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

describe("verifySlackRequest", () => {
  const originalSecret = process.env.SLACK_SIGNING_SECRET;

  beforeEach(() => {
    process.env.SLACK_SIGNING_SECRET = SIGNING_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.SLACK_SIGNING_SECRET;
    } else {
      process.env.SLACK_SIGNING_SECRET = originalSecret;
    }
  });

  it("accepts a valid signature", () => {
    const rawBody = JSON.stringify({ type: "event_callback", event: {} });
    const timestamp = currentTimestamp();

    expect(
      verifySlackRequest({
        signature: signSlackRequest(rawBody, timestamp),
        timestamp,
        rawBody,
      }),
    ).toBe(true);
  });

  it("rejects an invalid signature", () => {
    const rawBody = JSON.stringify({ type: "event_callback" });
    const timestamp = currentTimestamp();

    expect(
      verifySlackRequest({
        signature: signSlackRequest(rawBody, timestamp, "wrong-secret"),
        timestamp,
        rawBody,
      }),
    ).toBe(false);
  });

  it("rejects a timestamp older than 5 minutes", () => {
    const rawBody = JSON.stringify({ type: "event_callback" });
    const staleTimestamp = (
      Math.floor(Date.now() / 1000) -
      60 * 5 -
      1
    ).toString();

    expect(
      verifySlackRequest({
        signature: signSlackRequest(rawBody, staleTimestamp),
        timestamp: staleTimestamp,
        rawBody,
      }),
    ).toBe(false);
  });

  it("rejects a missing signature header", () => {
    const rawBody = JSON.stringify({ type: "event_callback" });

    expect(
      verifySlackRequest({
        signature: null,
        timestamp: currentTimestamp(),
        rawBody,
      }),
    ).toBe(false);
  });

  it("rejects a missing timestamp header", () => {
    const rawBody = JSON.stringify({ type: "event_callback" });

    expect(
      verifySlackRequest({
        signature: signSlackRequest(rawBody, currentTimestamp()),
        timestamp: null,
        rawBody,
      }),
    ).toBe(false);
  });

  it("rejects when the signing secret is missing", () => {
    delete process.env.SLACK_SIGNING_SECRET;

    const rawBody = JSON.stringify({ type: "event_callback" });
    const timestamp = currentTimestamp();

    expect(
      verifySlackRequest({
        signature: signSlackRequest(rawBody, timestamp),
        timestamp,
        rawBody,
      }),
    ).toBe(false);
  });

  it("rejects a malformed timestamp", () => {
    const rawBody = JSON.stringify({ type: "event_callback" });
    const malformedTimestamp = "not-a-number";

    expect(
      verifySlackRequest({
        signature: signSlackRequest(rawBody, malformedTimestamp),
        timestamp: malformedTimestamp,
        rawBody,
      }),
    ).toBe(false);
  });

  it("rejects when the raw body is tampered with after signing", () => {
    const originalBody = JSON.stringify({ type: "event_callback", text: "hi" });
    const tamperedBody = JSON.stringify({ type: "event_callback", text: "bye" });
    const timestamp = currentTimestamp();

    expect(
      verifySlackRequest({
        signature: signSlackRequest(originalBody, timestamp),
        timestamp,
        rawBody: tamperedBody,
      }),
    ).toBe(false);
  });
});
