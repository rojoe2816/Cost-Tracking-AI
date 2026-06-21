"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  Bot,
  FileText,
  KeyRound,
  LoaderCircle,
  Send,
  Trash2,
  User,
} from "lucide-react";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
};

type ChatResponse = {
  message?: string;
  error?: string;
};

const modelOptions = [
  { value: "chat-latest", label: "Chat latest" },
  { value: "gpt-5.5", label: "GPT-5.5" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 mini" },
] as const;

export function ChatInterface() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("chat-latest");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  async function sendMessage() {
    const content = draft.trim();

    if (!content || isSending) return;

    if (!apiKey.trim()) {
      setError("Enter an OpenAI API key before sending a message.");
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    const nextMessages = [...messages, userMessage];

    setDraft("");
    setError(null);
    setIsSending(true);
    setMessages(nextMessages);

    try {
      const response = await fetch("/test-site/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          model,
          messages: nextMessages.map(({ role, content: messageContent }) => ({
            role,
            content: messageContent,
          })),
        }),
      });
      const result = (await response.json()) as ChatResponse;

      if (!response.ok || !result.message) {
        throw new Error(result.error ?? "The request could not be completed.");
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.message as string,
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The request could not be completed.",
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-neutral-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-neutral-950 text-white">
              <Bot className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-semibold">Agent</h1>
              <a
                href="/test-site/company-data.pdf"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-neutral-500 transition hover:text-neutral-800"
              >
                <FileText className="size-3" aria-hidden="true" />
                Company data connected
              </a>
            </div>
          </div>

          <div className="flex flex-1 items-center gap-2 sm:max-w-xl">
            <label className="relative flex-1">
              <span className="sr-only">OpenAI API key</span>
              <KeyRound
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="OpenAI API key"
                autoComplete="off"
                spellCheck={false}
                className="h-10 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
              />
            </label>
            <label>
              <span className="sr-only">Model</span>
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              disabled={messages.length === 0 || isSending}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Clear conversation"
              title="Clear conversation"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 sm:px-6">
        <div className="flex-1 py-8" aria-live="polite">
          {messages.length === 0 ? (
            <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm">
                <Bot className="size-6" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                How can I help?
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
                Add an API key above, then start a conversation. Your key is
                kept only in this browser tab and is not saved.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {messages.map((message) => (
                <article key={message.id} className="flex gap-4">
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                      message.role === "assistant"
                        ? "bg-neutral-950 text-white"
                        : "border border-neutral-200 bg-white text-neutral-700"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <Bot className="size-4" aria-hidden="true" />
                    ) : (
                      <User className="size-4" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="mb-1 text-sm font-semibold">
                      {message.role === "assistant" ? "Agent" : "You"}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-neutral-800">
                      {message.content}
                    </p>
                  </div>
                </article>
              ))}

              {isSending ? (
                <div className="flex items-center gap-4 text-neutral-500">
                  <div className="flex size-8 items-center justify-center rounded-full bg-neutral-950 text-white">
                    <LoaderCircle
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-sm">Agent is thinking…</span>
                </div>
              ) : null}
              <div ref={endOfMessagesRef} />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gradient-to-t from-neutral-50 via-neutral-50 to-transparent pb-5 pt-8">
          {error ? (
            <p
              role="alert"
              className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          ) : null}
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-neutral-300 bg-white p-2 shadow-lg shadow-neutral-200/60"
          >
            <label htmlFor="message" className="sr-only">
              Message Agent
            </label>
            <textarea
              id="message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Message Agent"
              rows={2}
              disabled={isSending}
              className="max-h-40 min-h-14 w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-6 outline-none placeholder:text-neutral-400 disabled:opacity-60"
            />
            <div className="flex items-center justify-between gap-3 px-2 pb-1">
              <p className="text-xs text-neutral-400">
                Enter to send · Shift+Enter for a new line
              </p>
              <button
                type="submit"
                disabled={!draft.trim() || isSending}
                className="flex size-9 items-center justify-center rounded-full bg-neutral-950 text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                aria-label="Send message"
              >
                {isSending ? (
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </form>
          <p className="mt-2 text-center text-xs text-neutral-400">
            API usage may incur charges on the account associated with your key.
          </p>
        </div>
      </section>
    </main>
  );
}
