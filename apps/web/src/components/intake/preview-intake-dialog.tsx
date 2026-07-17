"use client";

import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { usePreviewIntake } from "@/lib/queries/use-intake-mutations";

export function PreviewIntakeDialog({
  intakeId,
  open,
  onOpenChange,
}: {
  intakeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const preview = usePreviewIntake();
  const query = useQuery({
    queryKey: ["intake-preview", intakeId],
    queryFn: () => preview(intakeId as string),
    enabled: open && !!intakeId,
  });
  const data = query.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Patient Intake Preview</DialogTitle>
          <DialogDescription>What the patient will see and complete.</DialogDescription>
        </DialogHeader>

        {query.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {data && (
          <div className="grid gap-4 text-sm">
            <div>
              <div className="font-medium">
                {data.patient.firstName} {data.patient.lastName}
              </div>
              <div className="text-muted-foreground">DOB: {data.patient.dob}</div>
            </div>
            {data.appointment && (
              <div>
                <div>{data.appointment.reasonForVisit}</div>
                <div className="text-muted-foreground">{new Date(data.appointment.scheduledAt).toLocaleString()}</div>
              </div>
            )}
            <div className="grid gap-1.5">
              <span className="text-muted-foreground">Sections completed so far</span>
              {data.sections.length === 0 ? (
                <Badge variant="muted">None yet</Badge>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {data.sections.map((s) => (
                    <Badge key={s.sectionType} variant={s.completedAt ? "default" : "outline"}>
                      {s.sectionType.replaceAll("_", " ")}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
