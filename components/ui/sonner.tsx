"use client";
import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "next-themes";

export function Toaster() {
  const { theme = "system" } = useTheme();
  return (
    <div
      onClick={(e) => {
        // Dismiss on toast click, but let the close button (X) still work normally
        const target = e.target as HTMLElement;
        if (target.closest("[data-close-button]")) return;
        toast.dismiss();
      }}
    >
      <Sonner
        theme={theme as "light" | "dark" | "system"}
        position="top-center"
        duration={2500}
        closeButton
        toastOptions={{
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg cursor-pointer",
            description: "group-[.toast]:text-muted-foreground",
            actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
            closeButton:
              "group-[.toast]:bg-background group-[.toast]:text-muted-foreground group-[.toast]:border-border",
          },
        }}
      />
    </div>
  );
}
