"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, Palette, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { ColorPicker } from "@/components/common/color-picker";
import { toast } from "sonner";
import { createService, updateService, archiveService, deleteService } from "@/lib/actions/services";
import { formatMoney, formatDuration } from "@/lib/utils";

type Service = {
  id: string;
  name: string;
  defaultDuration: number;
  defaultPrice: number;
  color: string;
  archived: boolean;
};

export function ServicesPage({ services, title }: { services: Service[]; title: string }) {
  const t = useTranslations("services");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  const active = services.filter((s) => !s.archived);
  const archived = services.filter((s) => s.archived);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          size="sm"
        >
          <Plus className="h-4 w-4" />
          {t("new")}
        </Button>
      </div>

      {active.length === 0 && archived.length === 0 && (
        <p className="border-y border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((s) => (
          <ServiceCard
            key={s.id}
            service={s}
            onEdit={() => {
              setEditing(s);
              setOpen(true);
            }}
          />
        ))}
      </div>

      {archived.length > 0 && (
        <>
          <h2 className="pt-4 text-sm font-medium text-muted-foreground">{t("archived")}</h2>
          <div className="grid gap-3 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((s) => (
              <ServiceCard
                key={s.id}
                service={s}
                onEdit={() => {
                  setEditing(s);
                  setOpen(true);
                }}
              />
            ))}
          </div>
        </>
      )}

      <ServiceDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function ServiceCard({ service, onEdit }: { service: Service; onEdit: () => void }) {
  const t = useTranslations("services");
  const [isPending, startTransition] = useTransition();

  const toggleArchive = () =>
    startTransition(async () => {
      await archiveService(service.id, !service.archived);
      toast.success(service.archived ? t("unarchive") : t("archive"));
    });

  const doDelete = () => {
    if (!confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      await deleteService(service.id);
      toast.success(t("delete"));
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40">
      <div className="flex items-start gap-3">
        <div
          className="h-3 w-3 shrink-0 rounded-full mt-2"
          style={{ backgroundColor: service.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{service.name}</div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(service.defaultDuration)}
            </span>
            <span className="font-medium text-foreground">{formatMoney(service.defaultPrice)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-1 justify-end">
        <Button variant="ghost" size="icon-sm" onClick={onEdit} disabled={isPending}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={toggleArchive} disabled={isPending}>
          {service.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={doDelete} disabled={isPending}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function ServiceDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Service | null;
}) {
  const t = useTranslations("services");
  const [color, setColor] = useState(editing?.color ?? "#6366f1");
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") || ""),
      defaultDuration: Number(fd.get("defaultDuration") || 60),
      defaultPrice: Number(fd.get("defaultPrice") || 0),
      color,
    };
    startTransition(async () => {
      try {
        if (editing) await updateService(editing.id, payload);
        else await createService(payload);
        toast.success(t("save"));
        onOpenChange(false);
      } catch {
        toast.error("Error");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) setColor(editing?.color ?? "#6366f1");
      }}
    >
      <DialogContent key={editing?.id ?? "new"}>
        <DialogHeader>
          <DialogTitle>{editing ? t("edit") : t("new")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" name="name" defaultValue={editing?.name} required autoFocus />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="defaultDuration">{t("defaultDuration")}</Label>
              <Input
                id="defaultDuration"
                name="defaultDuration"
                type="number"
                min="5"
                step="5"
                defaultValue={editing?.defaultDuration ?? 60}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultPrice">{t("defaultPrice")}</Label>
              <Input
                id="defaultPrice"
                name="defaultPrice"
                type="number"
                min="0"
                step="1"
                defaultValue={editing?.defaultPrice ?? 100}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>
              <Palette className="mr-1 inline h-3.5 w-3.5" />
              {t("color")}
            </Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <DialogFooter>
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
