import { cn } from "@/lib/utils";

interface ComingSoonBadgeProps {
  className?: string;
}

/**
 * Compact status pill indicating an upcoming feature.
 */
export function ComingSoonBadge({ className }: ComingSoonBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning border border-warning/30 whitespace-nowrap",
        className
      )}
    >
      Coming Soon
    </span>
  );
}
