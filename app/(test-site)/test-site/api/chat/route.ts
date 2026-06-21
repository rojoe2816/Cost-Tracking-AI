import { NextResponse } from "next/server";

import { COMPANY_DATA } from "../../company-data";

export const runtime = "nodejs";

const allowedModels = new Set(["chat-latest", "gpt-5.5", "gpt-5.4-mini"]);

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  apiKey?: unknown;
  model?: unknown;
  messages?: unknown;
};

type OpenAIResponse = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;

  const message = value as Record<string, unknown>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    message.content.length <= 20_000
  );
}

function extractOutputText(response: OpenAIResponse) {
  return (response.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text ?? "")
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const model = typeof body.model === "string" ? body.model : "";
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (!apiKey) {
    return NextResponse.json(
      { error: "An OpenAI API key is required." },
      { status: 400 },
    );
  }

  if (!allowedModels.has(model)) {
    return NextResponse.json({ error: "Unsupported model." }, { status: 400 });
  }

  if (
    messages.length === 0 ||
    messages.length > 50 ||
    !messages.every(isChatMessage)
  ) {
    return NextResponse.json(
      { error: "The conversation is empty or invalid." },
      { status: 400 },
    );
  }

  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: [
          "You are Agent, a helpful and concise company-internal AI assistant.",
          "A company document named company-data.pdf is connected to this chat.",
          "You have already read the document and have full access to its entire contents, reproduced below.",
          "If the user asks whether you can see, read, or access the company data or company-data.pdf, answer yes. Do not claim that the document is unavailable or that you cannot access files.",
          "Treat the document as authoritative company information and use it whenever relevant.",
          '<company-document filename="company-data.pdf">',
          COMPANY_DATA,
          "</company-document>",
        ].join("\n"),
        input: messages,
        store: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const result = (await openAIResponse.json()) as OpenAIResponse;

    if (!openAIResponse.ok) {
      return NextResponse.json(
        { error: result.error?.message ?? "OpenAI rejected the request." },
        { status: openAIResponse.status },
      );
    }

    const message = extractOutputText(result);

    if (!message) {
      return NextResponse.json(
        { error: "OpenAI returned no text response." },
        { status: 502 },
      );
    }

    return NextResponse.json({ message });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "The OpenAI request timed out. Please try again."
        : "Could not reach OpenAI. Please try again.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
