"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type UploadResultRow = {
  filename: string;
  status: string;
  external_ticket_id?: string;
  message?: string;
};

type TicketPdfUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketTypeId: number;
  ticketTypeName: string;
  /** Full upload endpoint URL */
  uploadUrl: string;
  onSuccess?: () => void;
};

export function TicketPdfUploadDialog({
  open,
  onOpenChange,
  ticketTypeId,
  ticketTypeName,
  uploadUrl,
  onSuccess,
}: TicketPdfUploadDialogProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [externalId, setExternalId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResultRow[] | null>(null);

  function reset() {
    setFiles([]);
    setExternalId("");
    setResults(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleUpload() {
    if (files.length === 0) {
      toast({
        title: "No files",
        description: "Select one or more PDF tickets to upload.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setResults(null);
    try {
      const form = new FormData();
      form.append("ticket_type_id", String(ticketTypeId));
      for (const file of files) {
        form.append("files", file);
      }
      if (files.length === 1 && externalId.trim()) {
        form.append("external_ticket_id", externalId.trim());
      }

      const res = await fetch(uploadUrl, {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Upload failed");
      }

      const rows = (json.data?.results ?? []) as UploadResultRow[];
      setResults(rows);

      const inserted = Number(json.data?.inserted ?? 0);
      const skipped = Number(json.data?.skipped ?? 0);
      toast({
        title: "Upload finished",
        description: `Inserted ${inserted}, skipped ${skipped}. Stock set to ${json.data?.quantity_available ?? "—"}.`,
      });

      if (inserted > 0) {
        onSuccess?.();
      }
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload PDF tickets</DialogTitle>
          <DialogDescription>
            Add Ticketwala PDFs to <strong>{ticketTypeName}</strong>. Filename
            must end with the ticket number, e.g.{" "}
            <code className="text-xs">002_Prism_Fam_2586389.pdf</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pdf-files">PDF files</Label>
            <Input
              id="pdf-files"
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={(e) => {
                const list = e.target.files;
                setFiles(list ? Array.from(list) : []);
                setResults(null);
              }}
            />
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {files.length} file{files.length === 1 ? "" : "s"} selected
              </p>
            )}
          </div>

          {files.length === 1 && (
            <div className="space-y-2">
              <Label htmlFor="external-id">
                Ticketwala id override{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="external-id"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="e.g. 2586389"
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">
                Use only if the filename does not end with the ticket number.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            PDFs are stored privately. Buyers receive a download only after
            payment. Duplicate ticket numbers are skipped.
          </div>

          {results && results.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border/50 text-xs">
              <ul className="divide-y divide-border/50">
                {results.map((row, idx) => (
                  <li
                    key={`${row.filename}-${idx}`}
                    className="flex items-start justify-between gap-2 px-3 py-2"
                  >
                    <span className="truncate font-mono">{row.filename}</span>
                    <span
                      className={
                        row.status === "ok"
                          ? "shrink-0 text-emerald-600 dark:text-emerald-400"
                          : "shrink-0 text-amber-700 dark:text-amber-300"
                      }
                    >
                      {row.status}
                      {row.external_ticket_id
                        ? ` · ${row.external_ticket_id}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={uploading}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => void handleUpload()}
              disabled={uploading || files.length === 0}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
