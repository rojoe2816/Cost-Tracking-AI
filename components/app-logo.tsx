import { Bot, ReceiptText } from "lucide-react";

export function AppLogo() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <ReceiptText className="h-7 w-7" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-heading text-xl font-semibold">Cost Tracking AI</span>
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">
          AI job costing for agency operators
        </p>
      </div>
    </div>
  );
}
