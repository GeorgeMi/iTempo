"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getDayOccurrences } from "@/lib/actions/appointments";
import { cn } from "@/lib/utils";

export type DayBusy = {
  startAt: string;
  endAt: string;
  appointmentId: string | null;
  recurringRuleId: string | null;
  originalStart: string;
  clientId: string;
  clientName: string;
  clientColor: string;
  serviceName: string;
  status: string;
};

export function useDayOccurrences(dateISO: string | null) {
  const [data, setData] = useState<DayBusy[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dateISO) return;
    setLoading(true);
    getDayOccurrences(dateISO)
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [dateISO]);

  return { busy: data, loading };
}

type Props = {
  date: Date;
  proposedStart: Date;
  proposedEnd: Date;
  busy: DayBusy[];
  excludeAppointmentId?: string | null;
  excludeOriginalStart?: string | null;
  onPickTime?: (time: Date) => void;
};

const DAY_START_MIN = 7 * 60; // 07:00
const DAY_END_MIN = 22 * 60; // 22:00
const PX_PER_MIN = 0.6; // compact: 15h → 540px total
const GUTTER_REM = 2.25; // width of the hour-label gutter (left-9)
const RIGHT_PAD_REM = 0.25; // right-1

function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

type LaidOut<T extends { startMin: number; endMin: number }> = T & {
  col: number;
  depth: number;
};

// Assigns each segment a column index (0-based) and a depth (total columns in its
// overlap cluster), so overlapping segments render side-by-side instead of stacked.
function layoutOverlaps<T extends { startMin: number; endMin: number }>(
  segs: T[],
): LaidOut<T>[] {
  if (segs.length === 0) return [];
  const sorted = [...segs].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // Group transitively overlapping segments
  const groups: T[][] = [];
  for (const s of sorted) {
    const hits: number[] = [];
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].some((x) => x.endMin > s.startMin && x.startMin < s.endMin)) {
        hits.push(i);
      }
    }
    if (hits.length === 0) {
      groups.push([s]);
    } else {
      const target = hits[0];
      groups[target].push(s);
      for (let i = hits.length - 1; i >= 1; i--) {
        groups[target].push(...groups[hits[i]]);
        groups.splice(hits[i], 1);
      }
    }
  }

  const out: LaidOut<T>[] = [];
  for (const g of groups) {
    g.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    const colEnds: number[] = [];
    const cols = new Map<T, number>();
    for (const s of g) {
      let col = colEnds.findIndex((e) => e <= s.startMin);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(s.endMin);
      } else {
        colEnds[col] = s.endMin;
      }
      cols.set(s, col);
    }
    const depth = colEnds.length;
    for (const s of g) out.push({ ...s, col: cols.get(s)!, depth });
  }
  return out;
}

export function DayTimeline({
  date,
  proposedStart,
  proposedEnd,
  busy,
  excludeAppointmentId,
  excludeOriginalStart,
  onPickTime,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const segments = useMemo(() => {
    const raw = busy
      .filter((b) => {
        if (b.status === "CANCELLED") return false;
        if (excludeAppointmentId && b.appointmentId === excludeAppointmentId) return false;
        if (excludeOriginalStart && b.originalStart === excludeOriginalStart) return false;
        return true;
      })
      .map((b) => {
        const start = new Date(b.startAt);
        const end = new Date(b.endAt);
        const startMin = Math.max(DAY_START_MIN, minutesOfDay(start));
        const endMin = Math.min(DAY_END_MIN, minutesOfDay(end));
        return {
          ...b,
          startMin,
          endMin,
          top: (startMin - DAY_START_MIN) * PX_PER_MIN,
          height: Math.max(10, (endMin - startMin) * PX_PER_MIN),
        };
      });
    return layoutOverlaps(raw);
  }, [busy, excludeAppointmentId, excludeOriginalStart]);

  const proposed = useMemo(() => {
    const startMin = Math.max(DAY_START_MIN, minutesOfDay(proposedStart));
    const endMin = Math.min(DAY_END_MIN, minutesOfDay(proposedEnd));
    if (endMin <= DAY_START_MIN || startMin >= DAY_END_MIN) return null;
    return {
      startMin,
      endMin,
      top: (startMin - DAY_START_MIN) * PX_PER_MIN,
      height: Math.max(14, (endMin - startMin) * PX_PER_MIN),
    };
  }, [proposedStart, proposedEnd]);

  const conflicts = useMemo(() => {
    if (!proposed) return [];
    return segments.filter((s) => s.endMin > proposed.startMin && s.startMin < proposed.endMin);
  }, [segments, proposed]);

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = 7; h <= 22; h++) arr.push(h);
    return arr;
  }, []);

  const totalHeight = (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN;

  // Auto-scroll the timeline so the proposed slot is in view
  useEffect(() => {
    if (!scrollRef.current || !proposed) return;
    const container = scrollRef.current;
    const targetTop = Math.max(0, proposed.top - 40);
    container.scrollTo({ top: targetTop, behavior: "smooth" });
  }, [proposed?.top]);

  const handleClickBg = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onPickTime) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    let minutes = DAY_START_MIN + y / PX_PER_MIN;
    minutes = Math.round(minutes / 15) * 15;
    const pick = new Date(date);
    pick.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    onPickTime(pick);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="label-xs">
          {date.toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "short" })}
        </div>
        {conflicts.length > 0 && (
          <span className="text-[11px] font-medium text-warning">⚠ {conflicts.length}</span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="relative overflow-y-auto rounded-md border border-border bg-background"
        style={{ maxHeight: 380 }}
      >
        <div
          className="relative cursor-crosshair select-none"
          style={{ height: totalHeight }}
          onClick={handleClickBg}
        >
          {hours.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-border/60 first:border-t-0"
              style={{ top: (h * 60 - DAY_START_MIN) * PX_PER_MIN, height: 60 * PX_PER_MIN }}
            >
              <div className="w-9 shrink-0 -mt-1.5 px-1 text-[10px] tabular-nums text-muted-foreground">
                {String(h).padStart(2, "0")}
              </div>
            </div>
          ))}

          {segments.map((s, i) => {
            const laneWidth = `calc((100% - ${GUTTER_REM}rem - ${RIGHT_PAD_REM}rem) / ${s.depth})`;
            return (
              <div
                key={i}
                className="absolute rounded-sm px-1.5 py-0 text-[10px] text-white pointer-events-none overflow-hidden"
                style={{
                  top: s.top,
                  height: s.height,
                  left: `calc(${GUTTER_REM}rem + ${laneWidth} * ${s.col})`,
                  width: `calc(${laneWidth} - 2px)`,
                  backgroundColor: s.clientColor,
                  opacity: 0.85,
                  lineHeight: `${Math.min(s.height - 2, 14)}px`,
                }}
              >
                <div className="truncate font-medium">{s.clientName}</div>
                {s.height > 24 && s.depth === 1 && (
                  <div className="truncate opacity-80 text-[9px]">{s.serviceName}</div>
                )}
              </div>
            );
          })}

          {proposed && (
            <div
              className={cn(
                "absolute left-9 right-1 rounded-md border-2 pointer-events-none flex items-center justify-center text-[10px] font-semibold",
                conflicts.length > 0
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-primary bg-primary/15 text-primary",
              )}
              style={{ top: proposed.top, height: proposed.height }}
            >
              {proposedStart.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      </div>

      {conflicts.length > 0 ? (
        <ul className="space-y-0.5 text-[11px]">
          {conflicts.map((c) => (
            <li
              key={c.appointmentId ?? c.originalStart}
              className="flex items-center gap-1.5 text-warning"
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: c.clientColor }}
              />
              <span className="truncate">{c.clientName}</span>
              <span className="tabular-nums text-muted-foreground ml-auto">
                {new Date(c.startAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[10px] text-muted-foreground">
          {segments.length === 0
            ? "Ziua e liberă"
            : `${segments.length} programări · click ca să alegi ora`}
        </p>
      )}
    </div>
  );
}
