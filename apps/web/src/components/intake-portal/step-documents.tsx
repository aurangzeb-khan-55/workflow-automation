"use client";

import { useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PortalDocument } from "@/lib/queries/use-patient-intake";
import { documentTypeLabel } from "./labels";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentSlot({
  documentType,
  documents,
  onUpload,
  onDelete,
  allowMultiple,
}: {
  documentType: string;
  documents: PortalDocument[];
  onUpload: (documentType: string, file: File) => Promise<unknown>;
  onDelete: (documentId: string) => Promise<unknown>;
  allowMultiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existing = documents.filter((d) => d.type === documentType);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      await onUpload(documentType, file);
    } catch {
      setError("Upload failed — please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{documentTypeLabel(documentType)}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {existing.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
            <a
              href={doc.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-2 hover:underline"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{doc.fileName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatSize(doc.sizeBytes)}</span>
            </a>
            <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(doc.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {(allowMultiple || existing.length === 0) && (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.pdf"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              {busy ? "Uploading…" : existing.length > 0 ? "Add another" : "Upload"}
            </Button>
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

export function StepDocuments({
  requiredDocumentTypes,
  documents,
  onUpload,
  onDelete,
  onNext,
  onBack,
}: {
  requiredDocumentTypes: string[];
  documents: PortalDocument[];
  onUpload: (documentType: string, file: File) => Promise<unknown>;
  onDelete: (documentId: string) => Promise<unknown>;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        Please upload the documents requested below. Accepted formats: photos (JPG/PNG) or PDF.
      </p>

      {requiredDocumentTypes.map((type) => (
        <DocumentSlot key={type} documentType={type} documents={documents} onUpload={onUpload} onDelete={onDelete} />
      ))}

      <DocumentSlot documentType="other" documents={documents} onUpload={onUpload} onDelete={onDelete} allowMultiple />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}
