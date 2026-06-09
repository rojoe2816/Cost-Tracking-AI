interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="font-heading text-4xl font-semibold tracking-tight text-balance">
        {title}
      </h2>
      <p className="max-w-3xl text-base leading-7 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
