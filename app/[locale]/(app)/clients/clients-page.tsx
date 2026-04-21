"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, Phone, Mail, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createClient, updateClient, archiveClient, deleteClient } from "@/lib/actions/clients";
import { formatMoney } from "@/lib/utils";

type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  color: string;
  defaultRate: number | null;
  archived: boolean;
};

export function ClientsPage({ clients, title }: { clients: Client[]; title: string }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [search, setSearch] = useState("");

  const active = clients.filter((c) => !c.archived && c.name.toLowerCase().includes(search.toLowerCase()));
  const archived = clients.filter((c) => c.archived && c.name.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (c: Client) => {
    setEditing(c);
    setOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4" />
          {t("new")}
        </Button>
      </div>

      <Input
        placeholder={tc("search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {active.length === 0 && archived.length === 0 && (
        <p className="border-y border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((c) => (
          <ClientCard key={c.id} client={c} onEdit={() => openEdit(c)} />
        ))}
      </div>

      {archived.length > 0 && (
        <>
          <h2 className="pt-4 text-sm font-medium text-muted-foreground">{t("archived")}</h2>
          <div className="grid gap-3 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((c) => (
              <ClientCard key={c.id} client={c} onEdit={() => openEdit(c)} />
            ))}
          </div>
        </>
      )}

      <ClientDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function ClientCard({ client, onEdit }: { client: Client; onEdit: () => void }) {
  const t = useTranslations("clients");
  const [isPending, startTransition] = useTransition();

  const toggleArchive = () => {
    startTransition(async () => {
      await archiveClient(client.id, !client.archived);
      toast.success(client.archived ? t("unarchive") : t("archive"));
    });
  };

  const doDelete = () => {
    if (!confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      await deleteClient(client.id);
      toast.success(t("delete"));
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40">
      <div className="flex items-start gap-3">
        <div
          className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold text-white"
          style={{ backgroundColor: client.color }}
        >
          {client.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{client.name}</div>
          <div className="mt-0.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
            {client.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {client.phone}
              </span>
            )}
            {client.email && (
              <span className="inline-flex items-center gap-1 truncate">
                <Mail className="h-3 w-3" /> {client.email}
              </span>
            )}
            {client.defaultRate != null && <span>{formatMoney(client.defaultRate)} / {t("defaultRate")}</span>}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-1 justify-end">
        <Button variant="ghost" size="icon-sm" onClick={onEdit} disabled={isPending} aria-label={t("edit")}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={toggleArchive} disabled={isPending} aria-label={client.archived ? t("unarchive") : t("archive")}>
          {client.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={doDelete} disabled={isPending} aria-label={t("delete")}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function ClientDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Client | null;
}) {
  const t = useTranslations("clients");
  const [color, setColor] = useState(editing?.color ?? "#6366f1");
  const [isPending, startTransition] = useTransition();

  // Reset when dialog reopens with different data
  if (typeof window !== "undefined") {
    // noop; controlled by key below
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get("name") || ""),
      phone: String(fd.get("phone") || "") || null,
      email: String(fd.get("email") || "") || null,
      notes: String(fd.get("notes") || "") || null,
      color,
      defaultRate: fd.get("defaultRate") ? Number(fd.get("defaultRate")) : null,
    };
    startTransition(async () => {
      try {
        if (editing) await updateClient(editing.id, payload);
        else await createClient(payload);
        toast.success(editing ? t("save") : t("new"));
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
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input id="phone" name="phone" type="tel" defaultValue={editing?.phone ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="defaultRate">{t("defaultRate")}</Label>
            <Input
              id="defaultRate"
              name="defaultRate"
              type="number"
              min="0"
              step="1"
              defaultValue={editing?.defaultRate ?? ""}
            />
            <p className="text-xs text-muted-foreground">{t("defaultRateHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label>
              <Palette className="mr-1 inline h-3.5 w-3.5" />
              {t("color")}
            </Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("notes")}</Label>
            <Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} />
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
