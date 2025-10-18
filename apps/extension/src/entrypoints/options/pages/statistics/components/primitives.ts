import { cva } from "class-variance-authority";

export const chartTitle = cva("", {
  variants: {
    color: {
      mute: "text-muted-foreground",
      default: "text-default-foreground",
    },
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
  },
  defaultVariants: {
    color: "default",
    size: "md",
  },
});
