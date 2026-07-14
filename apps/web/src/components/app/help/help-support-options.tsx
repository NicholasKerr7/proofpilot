import {
  ArrowRight,
  BookOpen,
  History,
  MessageCircle,
  ShieldCheck,
  type LucideIcon
} from "lucide-react";

interface HelpSupportOptionsProps {
  onBrowseArticles: () => void;
  onContactSupport: () => void;
  onOpenSecurityGuide: () => void;
}

export function HelpSupportOptions({
  onBrowseArticles,
  onContactSupport,
  onOpenSecurityGuide
}: HelpSupportOptionsProps) {
  const options: Array<{
    description: string;
    icon: LucideIcon;
    label: string;
    onClick: () => void;
  }> = [
    {
      description: "Open a private support request.",
      icon: MessageCircle,
      label: "Send a request",
      onClick: onContactSupport
    },
    {
      description: "Review requests and add follow-ups.",
      icon: History,
      label: "Request history",
      onClick: onContactSupport
    },
    {
      description: "See every Help Center guide.",
      icon: BookOpen,
      label: "Browse all guides",
      onClick: onBrowseArticles
    },
    {
      description: "Read workspace security guidance.",
      icon: ShieldCheck,
      label: "Security & privacy",
      onClick: onOpenSecurityGuide
    }
  ];

  return (
    <section aria-labelledby="help-support-options" className="hidden gap-3 md:grid">
      <h2 id="help-support-options" className="text-sm font-semibold uppercase text-primary">
        Support options
      </h2>
      <div className="grid grid-cols-4 gap-3">
        {options.map((option) => (
          <button
            className="group grid min-h-36 content-between gap-3 rounded-md border border-border bg-card p-4 text-left hover:border-primary/50 hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            key={option.label}
            onClick={option.onClick}
            type="button"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary">
              <option.icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{option.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {option.description}
              </span>
            </span>
            <ArrowRight
              aria-hidden="true"
              className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
