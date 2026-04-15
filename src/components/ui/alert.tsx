import * as React from "react"

import { cn } from "@/lib/utils"

function Alert({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert"
      role="note"
      className={cn(
        "border-border/60 bg-muted/35 text-foreground flex gap-2 rounded-lg border px-3 py-2 text-xs leading-snug [&>svg]:text-muted-foreground [&>svg]:mt-0.5 [&>svg]:size-3.5 [&>svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

function AlertTitle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("text-foreground font-medium", className)}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-muted-foreground min-w-0 flex-1 [&_p]:leading-snug", className)}
      {...props}
    />
  )
}

export { Alert, AlertDescription, AlertTitle }
