"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProvidersQuery } from "@/lib/queries/use-providers";
import { useSendIntakeEmailMutation, useUpdateIntakeMutation } from "@/lib/queries/use-intake-mutations";
import type { IntakeListItem } from "@/lib/queries/use-intakes";

const formSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  reasonForVisit: z.string().min(1, "Required"),
  providerId: z.string().optional(),
  scheduledDate: z.string().min(1, "Required"),
  scheduledTime: z.string().min(1, "Required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

/** Draft Workflow: edit patient/appointment fields, save changes, and send whenever ready — all from one place, no review-modal ceremony (that's only for the initial Create Intake action). */
export function EditIntakeDialog({
  intake,
  open,
  onOpenChange,
  onSuccess,
}: {
  intake: IntakeListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (message: string) => void;
}) {
  const providersQuery = useProvidersQuery();
  const updateIntake = useUpdateIntakeMutation();
  const sendEmail = useSendIntakeEmailMutation();

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  useEffect(() => {
    if (!intake) return;
    const scheduled = intake.appointment ? new Date(intake.appointment.scheduledAt) : null;
    form.reset({
      firstName: intake.patient?.firstName ?? "",
      lastName: intake.patient?.lastName ?? "",
      reasonForVisit: intake.appointment?.reasonForVisit ?? "",
      providerId: intake.appointment?.providerId ?? undefined,
      scheduledDate: scheduled ? scheduled.toISOString().slice(0, 10) : "",
      scheduledTime: scheduled ? scheduled.toISOString().slice(11, 16) : "",
      notes: "",
    });
  }, [intake, form]);

  if (!intake) return null;

  async function onSave(values: FormValues) {
    if (!intake) return;
    await updateIntake.mutateAsync({
      id: intake.id,
      input: {
        firstName: values.firstName,
        lastName: values.lastName,
        reasonForVisit: values.reasonForVisit,
        providerId: values.providerId || undefined,
        scheduledAt: new Date(`${values.scheduledDate}T${values.scheduledTime}`).toISOString(),
        notes: values.notes || undefined,
      },
    });
    onOpenChange(false);
    onSuccess?.("Draft updated.");
  }

  async function onSend() {
    if (!intake) return;
    await sendEmail.mutateAsync(intake.id);
    onOpenChange(false);
    onSuccess?.("Intake email sent.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Draft Intake</DialogTitle>
          <DialogDescription>Update the details, then save or send the intake email whenever ready.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSave)} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-firstName">First name</Label>
              <Input id="edit-firstName" {...form.register("firstName")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-lastName">Last name</Label>
              <Input id="edit-lastName" {...form.register("lastName")} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="edit-reasonForVisit">Reason for visit</Label>
            <Input id="edit-reasonForVisit" {...form.register("reasonForVisit")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Preferred provider</Label>
              <Select
                value={form.watch("providerId") ?? "none"}
                onValueChange={(v) => form.setValue("providerId", v === "none" ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preference</SelectItem>
                  {(providersQuery.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-scheduledDate">Appt. date</Label>
                <Input id="edit-scheduledDate" type="date" {...form.register("scheduledDate")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-scheduledTime">Time</Label>
                <Input id="edit-scheduledTime" type="time" {...form.register("scheduledTime")} />
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="edit-notes">Notes (optional)</Label>
            <Textarea id="edit-notes" {...form.register("notes")} />
          </div>

          {(updateIntake.isError || sendEmail.isError) && (
            <p className="text-sm text-destructive">
              {((updateIntake.error ?? sendEmail.error) as Error).message}
            </p>
          )}

          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button type="submit" variant="outline" disabled={updateIntake.isPending}>
                Save Changes
              </Button>
              <Button type="button" disabled={sendEmail.isPending} onClick={onSend}>
                Send Intake Email
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
