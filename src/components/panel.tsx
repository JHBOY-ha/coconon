import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[2rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_20px_80px_rgba(95,70,30,0.1)] backdrop-blur",
        className,
      )}
    >
      {children}
    </section>
  );
}
