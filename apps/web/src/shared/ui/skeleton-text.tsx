import { cn } from "cn";

export function SkeletonText({
  className,
  width = "100%",
  ...props
}: React.ComponentProps<"span"> & { width?: string }) {
  return (
    <span
      data-slot="skeleton-text"
      aria-hidden="true"
      className={cn(
        "inline-block w-(--skeleton-width) animate-pulse rounded-sm bg-accent align-middle",
        className
      )}
      style={{ height: "1em", "--skeleton-width": width } as React.CSSProperties}
      {...props}
    >
      {"​"}
    </span>
  );
}
