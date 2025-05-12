import { cn } from "@/utils/tailwind";

type LoadingDotsProps = {
  className?: string;
};

export default function LoadingDots({ className }: LoadingDotsProps) {
  return (
    <div
      className={cn("flex items-center justify-center gap-[3px]", className)}
    >
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="h-1.5 w-1 animate-bounce rounded-full bg-black dark:bg-white"
          style={{
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}
