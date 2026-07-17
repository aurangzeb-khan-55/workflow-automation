"use client";

import { useState } from "react";
import { Eye, Inbox, Mail, Pencil, Trash2 } from "lucide-react";
import { useDashboardFiltersStore } from "@/store/dashboard-filters.store";
import { useIntakesQuery, IntakeListItem } from "@/lib/queries/use-intakes";
import { useProvidersQuery } from "@/lib/queries/use-providers";
import { useDeleteIntakeMutation, useSendIntakeEmailMutation } from "@/lib/queries/use-intake-mutations";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CreateIntakeDialog } from "@/components/intake/create-intake-dialog";
import { EditIntakeDialog } from "@/components/intake/edit-intake-dialog";
import { PreviewIntakeDialog } from "@/components/intake/preview-intake-dialog";
import { ReviewIntakeDialog } from "@/components/intake/review-intake-dialog";

/** Once an intake has been submitted, the eye icon opens the full review + package + Jane workflow instead of the forward-looking patient-experience preview. */
const REVIEWABLE_STATUSES = new Set(["ready_for_staff_review", "uploaded_to_jane", "completed"]);

const STATUS_OPTIONS = [
  "draft",
  "intake_email_sent",
  "patient_started_intake",
  "waiting_for_patient",
  "missing_documents",
  "intake_submitted",
  "ready_for_staff_review",
  "uploaded_to_jane",
  "completed",
] as const;

function statusLabel(status: string): string {
  // "Missing Information" reads better to staff than the internal enum
  // name, which is really about the future Documents/Consents module.
  if (status === "missing_documents") return "Missing Information";
  return status
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function EmptyIntakesState({ hasActiveFilters, onClearFilters }: { hasActiveFilters: boolean; onClearFilters: () => void }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="grid gap-1">
        <p className="font-medium">{hasActiveFilters ? "No intakes match your filters." : "No intakes yet."}</p>
        <p className="text-sm text-muted-foreground">
          {hasActiveFilters ? "Try adjusting or clearing your filters." : "Create your first intake to get started."}
        </p>
      </div>
      {hasActiveFilters && (
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

export default function StaffDashboardPage() {
  const filters = useDashboardFiltersStore();
  const providersQuery = useProvidersQuery();
  const intakesQuery = useIntakesQuery({
    search: filters.search,
    providerId: filters.providerId,
    status: filters.status,
    appointmentDate: filters.appointmentDate,
  });
  const sendEmail = useSendIntakeEmailMutation();
  const deleteIntake = useDeleteIntakeMutation();

  const [banner, setBanner] = useState<string | null>(null);
  const [editingIntake, setEditingIntake] = useState<IntakeListItem | null>(null);
  const [previewIntakeId, setPreviewIntakeId] = useState<string | null>(null);
  const [reviewIntakeId, setReviewIntakeId] = useState<string | null>(null);

  function flash(message: string) {
    setBanner(message);
    setTimeout(() => setBanner(null), 4000);
  }

  function openViewer(intake: IntakeListItem) {
    if (REVIEWABLE_STATUSES.has(intake.status)) {
      setReviewIntakeId(intake.id);
    } else {
      setPreviewIntakeId(intake.id);
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Intake Status Dashboard</h1>
        <CreateIntakeDialog onSuccess={flash} />
      </div>

      {banner && (
        <div className="mt-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          {banner}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Patient name</label>
          <Input
            placeholder="Search by name"
            value={filters.search}
            onChange={(e) => filters.setSearch(e.target.value)}
            className="w-48"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select
            value={filters.status ?? "all"}
            onValueChange={(value) => filters.setStatus(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Provider</label>
          <Select
            value={filters.providerId ?? "all"}
            onValueChange={(value) => filters.setProviderId(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All providers</SelectItem>
              {(providersQuery.data ?? []).map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Appointment date</label>
          <Input
            type="date"
            value={filters.appointmentDate ?? ""}
            onChange={(e) => filters.setAppointmentDate(e.target.value || null)}
            className="w-44"
          />
        </div>

        <Button variant="outline" onClick={() => filters.reset()}>
          Clear filters
        </Button>
      </div>

      <div className="mt-6">
        {intakesQuery.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {intakesQuery.isError && (
          <p className="text-destructive">Failed to load intakes: {(intakesQuery.error as Error).message}</p>
        )}
        {intakesQuery.data && intakesQuery.data.length === 0 && (
          <EmptyIntakesState
            hasActiveFilters={
              filters.search !== "" || filters.providerId !== null || filters.status !== null || filters.appointmentDate !== null
            }
            onClearFilters={filters.reset}
          />
        )}
        {intakesQuery.data && intakesQuery.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason for visit</TableHead>
                <TableHead>Appointment</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {intakesQuery.data.map((intake) => (
                <TableRow key={intake.id}>
                  <TableCell>
                    {intake.patient ? `${intake.patient.firstName} ${intake.patient.lastName}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={intake.status === "draft" ? "outline" : "muted"}>
                      {statusLabel(intake.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{intake.appointment?.reasonForVisit ?? "—"}</TableCell>
                  <TableCell>
                    {intake.appointment ? new Date(intake.appointment.scheduledAt).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {intake.status === "draft" ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setEditingIntake(intake)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewer(intake)}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={sendEmail.isPending}
                            onClick={async () => {
                              await sendEmail.mutateAsync(intake.id);
                              flash("Intake email sent.");
                            }}
                            title="Send Intake Email"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deleteIntake.isPending}
                            onClick={async () => {
                              if (!confirm("Delete this draft intake? This cannot be undone.")) return;
                              await deleteIntake.mutateAsync(intake.id);
                              flash("Draft deleted.");
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => openViewer(intake)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <EditIntakeDialog
        intake={editingIntake}
        open={editingIntake !== null}
        onOpenChange={(open) => !open && setEditingIntake(null)}
        onSuccess={flash}
      />
      <PreviewIntakeDialog
        intakeId={previewIntakeId}
        open={previewIntakeId !== null}
        onOpenChange={(open) => !open && setPreviewIntakeId(null)}
      />
      <ReviewIntakeDialog
        intakeId={reviewIntakeId}
        open={reviewIntakeId !== null}
        onOpenChange={(open) => !open && setReviewIntakeId(null)}
        onSuccess={flash}
      />
    </main>
  );
}
