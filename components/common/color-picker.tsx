"use client";
import { COLOR_PALETTE, cn } from "@/lib/utils";

export function ColorPicker({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (c: string) => void;
  name?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {name && <input type="hidden" name={name} value={value} />}
      {COLOR_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{ backgroundColor: c }}
          className={cn(
            "h-7 w-7 rounded-full border-2 transition-transform",
            value === c ? "border-foreground scale-110 shadow" : "border-transparent hover:scale-105",
          )}
          aria-label={c}
        />
      ))}
    </div>
  );
}
