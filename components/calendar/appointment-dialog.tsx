"use client";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createAppointment,
  deleteAppointment,
  deleteRecurringRule,
  materializeOccurrence,
  setStatus,
  togglePaid,
  updateAppointment,
} from "@/lib/actions/appointments";
import { Check, Trash2, AlertTriangle } from "lucide-react";
import { DayTimeline, useDayOccurrences } from "./day-timeline";

type Client = { id: string; name: string; color: string; defaultRate: number | null; defaultDuration: number | null };
type Service = { id: string; name: string; color: string; defaultDuration: number; defaultPrice: number };

type Occurrence = {
  kind: "virtual" | "materialized";
  recurringRuleId: string;
  clientId: string;
  serviceId: string;
  startAt: string;
  endAt: string;
  price: number;
  originalStart: string;
  materialized?: {
    id: string;
    status: string;
    paid: boolean;
    notes?: string | null;
    recurringRuleId: string | null;
    startAt: string;
    endAt: string;
  };
};

export type AppointmentDialogInput =
  | { mode: "create"; defaultStart: Date; defaultEnd: Date }
  | { mode: "edit"; occurrence: Occurrence };

export function AppointmentDialog({
  input,
  clients,
  services,
  onClose,
  onSaved,
}: {
  input: AppointmentDialogInput;
  clients: Client[];
  services: Service[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("appointment");
  const [isPending, startTransition] = useTransition();

  const initial =
    input.mode === "edit"
      ? {
          clientId: input.occurrence.clientId,
          serviceId: input.occurrence.serviceId,
          start: new Date(input.occurrence.startAt),
          end: new Date(input.occurrence.endAt),
          duration: Math.max(
            5,
            Math.round(
              (new Date(input.occurrence.endAt).getTime() -
                new Date(input.occurrence.startAt).getTime()) /
                60_000,
            ),
          ),
          price: input.occurrence.price,
          status: input.occurrence.materialized?.status ?? "SCHEDULED",
          paid: !!input.occurrence.materialized?.paid,
          notes: input.occurrence.materialized?.notes ?? "",
        }
      : {
          clientId: clients[0]?.id ?? "",
          serviceId: services[0]?.id ?? "",
          start: input.defaultStart,
          end: input.defaultEnd,
          duration: clients[0]?.defaultDuration ?? services[0]?.defaultDuration ?? 60,
          price: clients[0]?.defaultRate ?? services[0]?.defaultPrice ?? 0,
          status: "SCHEDULED",
          paid: false,
          notes: "",
        };

  const [clientId, setClientIdState] = useState(initial.clientId);
  const [serviceId, setServiceIdState] = useState(initial.serviceId);
  const [date, setDate] = useState(toDateInput(initial.start));
  const [startTime, setStartTime] = useState(toTimeInput(initial.start));
  const [durationInput, setDurationInput] = useState(String(initial.duration));
  const [priceInput, setPriceInput] = useState(String(initial.price));
  const duration = Math.max(0, Number(durationInput) || 0);
  const price = Math.max(0, Number(priceInput) || 0);
  const [status, setStatusLocal] = useState(initial.status);
  const [paid, setPaid] = useState(initial.paid);
  const [notes, setNotes] = useState(initial.notes);
  const [recurring, setRecurring] = useState<"NONE" | "WEEKLY" | "BIWEEKLY" | "MONTHLY">("NONE");
  const [recurrenceEnd, setRecurrenceEnd] = useState("");

  const startDate = useMemo(() => combine(date, startTime), [date, startTime]);
  const endDate = useMemo(() => new Date(startDate.getTime() + duration * 60_000), [startDate, duration]);

  const { busy } = useDayOccurrences(date);

  const conflicts = useMemo(() => {
    return busy.filter((b) => {
      if (b.status === "CANCELLED") return false;
      const bs = new Date(b.startAt).getTime();
      const be = new Date(b.endAt).getTime();
      const s = startDate.getTime();
      const e = endDate.getTime();
      if (be <= s || bs >= e) return false;
      // exclude self when editing
      if (input.mode === "edit") {
        if (input.occurrence.materialized?.id && b.appointmentId === input.occurrence.materialized.id) return false;
        if (input.occurrence.originalStart === b.originalStart) return false;
      }
      return true;
    });
  }, [busy, startDate, endDate, input]);

  const setClientId = (id: string) => {
    setClientIdState(id);
    if (input.mode === "create") {
      const c = clients.find((x) => x.id === id);
      const s = services.find((x) => x.id === serviceId);
      if (c?.defaultRate != null) setPriceInput(String(c.defaultRate));
      else if (s) setPriceInput(String(s.defaultPrice));
      if (c?.defaultDuration != null) setDurationInput(String(c.defaultDuration));
      else if (s) setDurationInput(String(s.defaultDuration));
    }
  };
  const setServiceId = (id: string) => {
    setServiceIdState(id);
    const s = services.find((x) => x.id === id);
    if (!s) return;
    if (input.mode === "create") {
      const c = clients.find((x) => x.id === clientId);
      setDurationInput(String(c?.defaultDuration ?? s.defaultDuration));
      setPriceInput(String(c?.defaultRate ?? s.defaultPrice));
    }
  };

  const isEdit = input.mode === "edit";
  const isRecurringOccurrence = isEdit && !!input.occurrence.recurringRuleId;
  const isMaterialized = isEdit && !!input.occurrence.materialized;

  const submit = async () => {
    if (conflicts.length > 0) {
      const names = conflicts.map((c) => c.clientName).join(", ");
      const ok = confirm(
        (t("conflictWarning") || `Conflict cu: ${names}. Continui oricum?`).replace("{names}", names),
      );
      if (!ok) return;
    }

    const payload = {
      clientId,
      serviceId,
      startAt: startDate,
      endAt: endDate,
      price,
      status: status as "SCHEDULED" | "DONE" | "CANCELLED" | "NO_SHOW",
      paid,
      notes: notes || null,
    };

    try {
      if (input.mode === "create") {
        await createAppointment({
          appointment: payload,
          recurrence:
            recurring === "NONE" ? null : { frequency: recurring, endsOn: recurrenceEnd || null },
        });
      } else if (isMaterialized && input.occurrence.materialized) {
        await updateAppointment(input.occurrence.materialized.id, payload);
      } else {
        await materializeOccurrence({
          ruleId: input.occurrence.recurringRuleId,
          originalStart: input.occurrence.originalStart,
          overrides: {
            startAt: startDate.toISOString(),
            endAt: endDate.toISOString(),
            price,
            status: payload.status,
            paid,
            notes: notes || null,
          },
        });
      }
      toast.success(t("save"));
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error("Error");
    }
  };

  const deleteOnlyThis = async () => {
    if (input.mode !== "edit") return;
    if (!confirm(t("deleteConfirm"))) return;
    if (input.occurrence.materialized) {
      if (input.occurrence.materialized.recurringRuleId) {
        await materializeOccurrence({
          ruleId: input.occurrence.recurringRuleId,
          originalStart: input.occurrence.originalStart,
          overrides: { status: "CANCELLED" },
        });
      } else {
        await deleteAppointment(input.occurrence.materialized.id);
      }
    } else {
      await materializeOccurrence({
        ruleId: input.occurrence.recurringRuleId,
        originalStart: input.occurrence.originalStart,
        overrides: { status: "CANCELLED" },
      });
    }
    toast.success(t("delete"));
    onSaved();
  };

  const deleteSeries = async () => {
    if (input.mode !== "edit" || !input.occurrence.recurringRuleId) return;
    if (!confirm(t("deleteConfirm"))) return;
    await deleteRecurringRule(input.occurrence.recurringRuleId);
    toast.success(t("delete"));
    onSaved();
  };

  const markPaid = async () => {
    if (input.mode !== "edit") return;
    if (input.occurrence.materialized) {
      await togglePaid(input.occurrence.materialized.id, !paid);
      setPaid(!paid);
    } else {
      await materializeOccurrence({
        ruleId: input.occurrence.recurringRuleId,
        originalStart: input.occurrence.originalStart,
        overrides: { paid: !paid },
      });
      setPaid(!paid);
    }
    toast.success(t("save"));
    onSaved();
  };

  const markDone = async () => {
    if (input.mode !== "edit") return;
    if (input.occurrence.materialized) {
      await setStatus(input.occurrence.materialized.id, "DONE");
    } else {
      await materializeOccurrence({
        ruleId: input.occurrence.recurringRuleId,
        originalStart: input.occurrence.originalStart,
        overrides: { status: "DONE" },
      });
    }
    setStatusLocal("DONE");
    toast.success(t("save"));
    onSaved();
  };

  const onPickTime = (time: Date) => {
    setStartTime(
      `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`,
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-medium tracking-tight">
            {isEdit ? t("edit") : t("new")}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(submit);
          }}
          className="grid gap-6 sm:grid-cols-[1fr_260px]"
        >
          {/* Left column — form */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("client")}</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("service")}</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t("date")}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t("startTime")}</Label>
                <Input
                  type="time"
                  value={startTime}
                  step={900}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("duration")}</Label>
                <Input
                  type="number"
                  min="5"
                  step="5"
                  inputMode="numeric"
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  onBlur={() => {
                    if (durationInput === "" || Number(durationInput) < 5) {
                      setDurationInput("5");
                    }
                  }}
                  required
                />
              </div>
            </div>

            {conflicts.length > 0 && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">
                    Suprapunere cu {conflicts.length}{" "}
                    {conflicts.length === 1 ? "programare" : "programări"}
                  </div>
                  <ul className="mt-0.5">
                    {conflicts.map((c) => (
                      <li key={c.appointmentId ?? c.originalStart}>
                        {c.clientName} ·{" "}
                        <span className="tabular-nums">
                          {new Date(c.startAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          –
                          {new Date(c.endAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("price")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  onBlur={() => {
                    if (priceInput === "") setPriceInput("0");
                  }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("status")}</Label>
                <Select value={status} onValueChange={(v) => setStatusLocal(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCHEDULED">{t("statusScheduled")}</SelectItem>
                    <SelectItem value="DONE">{t("statusDone")}</SelectItem>
                    <SelectItem value="CANCELLED">{t("statusCancelled")}</SelectItem>
                    <SelectItem value="NO_SHOW">{t("statusNoShow")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="paid-switch" className="cursor-pointer">
                {t("paid")}
              </Label>
              <Switch id="paid-switch" checked={paid} onCheckedChange={setPaid} />
            </div>

            {!isEdit && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("recurring")}</Label>
                  <Select value={recurring} onValueChange={(v) => setRecurring(v as typeof recurring)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">{t("recurringNo")}</SelectItem>
                      <SelectItem value="WEEKLY">{t("recurringWeekly")}</SelectItem>
                      <SelectItem value="BIWEEKLY">{t("recurringBiweekly")}</SelectItem>
                      <SelectItem value="MONTHLY">{t("recurringMonthly")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {recurring !== "NONE" && (
                  <div className="space-y-1.5">
                    <Label>{t("recurringUntil")}</Label>
                    <Input
                      type="date"
                      value={recurrenceEnd}
                      onChange={(e) => setRecurrenceEnd(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t("notes")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            {isEdit && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={markPaid}>
                  <Check className="h-4 w-4" />
                  {paid ? t("markUnpaid") : t("markPaid")}
                </Button>
                {status !== "DONE" && (
                  <Button type="button" variant="outline" size="sm" onClick={markDone}>
                    {t("markDone")}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Right column — day timeline (desktop) */}
          <div className="hidden sm:block">
            <DayTimeline
              date={startDate}
              proposedStart={startDate}
              proposedEnd={endDate}
              busy={busy}
              excludeAppointmentId={input.mode === "edit" ? input.occurrence.materialized?.id : null}
              excludeOriginalStart={input.mode === "edit" ? input.occurrence.originalStart : null}
              onPickTime={onPickTime}
            />
          </div>

          <DialogFooter className="sm:col-span-2 flex-wrap gap-2">
            {isEdit && (
              <>
                <Button type="button" variant="ghost" onClick={deleteOnlyThis}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                  {isRecurringOccurrence ? t("deleteOnlyThis") : t("delete")}
                </Button>
                {isRecurringOccurrence && (
                  <Button type="button" variant="ghost" onClick={deleteSeries}>
                    {t("deleteSeries")}
                  </Button>
                )}
              </>
            )}
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toTimeInput(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function combine(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}
