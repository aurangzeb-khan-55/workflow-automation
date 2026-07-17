"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, FileText, PackageCheck, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useDownloadPackageMutation,
  useMarkCompletedMutation,
  useMarkUploadedToJaneMutation,
  useReviewIntake,
} from "@/lib/queries/use-intake-mutations";
import { documentTypeLabel, consentTypeLabel } from "@/components/intake-portal/labels";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}

function formatList(items: unknown): string {
  return Array.isArray(items) && items.length > 0 ? items.join(", ") : "None reported";
}

export function ReviewIntakeDialog({
  intakeId,
  open,
  onOpenChange,
  onSuccess,
}: {
  intakeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (message: string) => void;
}) {
  const review = useReviewIntake();
  const query = useQuery({
    queryKey: ["intake-review", intakeId],
    queryFn: () => review(intakeId as string),
    enabled: open && !!intakeId,
  });
  const downloadPackage = useDownloadPackageMutation();
  const markUploadedToJane = useMarkUploadedToJaneMutation();
  const markCompleted = useMarkCompletedMutation();
  const [error, setError] = useState<string | null>(null);

  const data = query.data;
  const personalInfo = data?.personalInfo as
    | { address?: { street?: string; city?: string; state?: string; zip?: string }; gender?: string; preferredPharmacy?: string; emergencyContact?: { name?: string; phone?: string; relationship?: string } }
    | undefined;
  const medicalHistory = data?.medicalHistory as
    | { conditions?: string[]; surgicalHistory?: string[]; medications?: string[]; allergies?: string[]; familyHistory?: string[]; socialHistory?: string[] }
    | undefined;
  const insuranceInfo = data?.insuranceInfo as
    | { noInsurance?: boolean; payerName?: string; policyNumber?: string; groupNumber?: string; subscriberName?: string; relationshipToSubscriber?: string }
    | undefined;

  async function handleDownloadPackage() {
    setError(null);
    try {
      await downloadPackage.mutateAsync(intakeId as string);
    } catch {
      setError("Couldn't generate the document package. Please try again.");
    }
  }

  async function handleMarkUploadedToJane() {
    setError(null);
    try {
      await markUploadedToJane.mutateAsync(intakeId as string);
      onSuccess?.("Marked as uploaded to Jane.");
    } catch {
      setError("Couldn't update the status. Please try again.");
    }
  }

  async function handleMarkCompleted() {
    setError(null);
    try {
      await markCompleted.mutateAsync(intakeId as string);
      onSuccess?.("Intake marked as completed.");
    } catch {
      setError("Couldn't update the status. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Intake Review</DialogTitle>
          <DialogDescription>Everything the patient submitted — read-only.</DialogDescription>
        </DialogHeader>

        {query.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {data && (
          <div className="grid gap-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {data.patient.firstName} {data.patient.lastName}
                </div>
                <div className="text-muted-foreground">DOB: {data.patient.dob}</div>
              </div>
              <Badge>{data.status.replaceAll("_", " ")}</Badge>
            </div>

            {data.appointment && (
              <div>
                <div>{data.appointment.reasonForVisit}</div>
                <div className="text-muted-foreground">{new Date(data.appointment.scheduledAt).toLocaleString()}</div>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Field
                  label="Address"
                  value={
                    personalInfo?.address
                      ? `${personalInfo.address.street ?? ""}, ${personalInfo.address.city ?? ""}, ${personalInfo.address.state ?? ""} ${personalInfo.address.zip ?? ""}`
                      : ""
                  }
                />
                <Field label="Phone" value={data.patient.phone} />
                <Field label="Email" value={data.patient.email} />
                <Field label="Gender" value={personalInfo?.gender ?? ""} />
                <Field label="Preferred Pharmacy" value={personalInfo?.preferredPharmacy ?? ""} />
                <Field
                  label="Emergency Contact"
                  value={
                    personalInfo?.emergencyContact?.name
                      ? `${personalInfo.emergencyContact.name} (${personalInfo.emergencyContact.relationship ?? "—"}) — ${personalInfo.emergencyContact.phone ?? "—"}`
                      : ""
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Medical History</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Field label="Conditions" value={formatList(medicalHistory?.conditions)} />
                <Field label="Surgical History" value={formatList(medicalHistory?.surgicalHistory)} />
                <Field label="Medications" value={formatList(medicalHistory?.medications)} />
                <Field label="Allergies" value={formatList(medicalHistory?.allergies)} />
                <Field label="Family History" value={formatList(medicalHistory?.familyHistory)} />
                <Field label="Social History" value={formatList(medicalHistory?.socialHistory)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Insurance Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {insuranceInfo?.noInsurance ? (
                  <div className="col-span-2 text-muted-foreground">Self-pay (no insurance on file)</div>
                ) : (
                  <>
                    <Field label="Provider" value={insuranceInfo?.payerName ?? ""} />
                    <Field label="Policy Number" value={insuranceInfo?.policyNumber ?? ""} />
                    <Field label="Group Number" value={insuranceInfo?.groupNumber ?? ""} />
                    <Field
                      label="Subscriber"
                      value={insuranceInfo?.subscriberName ? `${insuranceInfo.subscriberName} (${insuranceInfo.relationshipToSubscriber ?? "—"})` : ""}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Uploaded Documents</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {data.documents.length === 0 && <p className="text-muted-foreground">None uploaded.</p>}
                {data.documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-md border border-border p-2 hover:bg-muted"
                  >
                    {doc.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={doc.downloadUrl} alt={doc.fileName} className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{documentTypeLabel(doc.type)}</div>
                      <div className="truncate text-xs text-muted-foreground">{doc.fileName}</div>
                    </div>
                  </a>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Signed Consent Forms</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {data.consents.length === 0 && <p className="text-muted-foreground">None signed.</p>}
                {data.consents.map((consent) => (
                  <div key={consent.type} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>{consentTypeLabel(consent.type)}</span>
                    <span className="text-xs text-muted-foreground">signed {new Date(consent.signedAt).toLocaleString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {error && <p className="text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {data && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={downloadPackage.isPending} onClick={handleDownloadPackage}>
                <Download className="h-4 w-4" />
                {downloadPackage.isPending ? "Preparing…" : "Download Package"}
              </Button>
              {data.status === "ready_for_staff_review" && (
                <Button disabled={markUploadedToJane.isPending} onClick={handleMarkUploadedToJane}>
                  <Upload className="h-4 w-4" />
                  Mark as Uploaded to Jane
                </Button>
              )}
              {data.status === "uploaded_to_jane" && (
                <Button disabled={markCompleted.isPending} onClick={handleMarkCompleted}>
                  <PackageCheck className="h-4 w-4" />
                  Mark as Completed
                </Button>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
