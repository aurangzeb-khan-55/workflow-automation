"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Clock, Mail, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProvidersQuery } from "@/lib/queries/use-providers";
import { useCreateIntakeMutation, CreateIntakeInput } from "@/lib/queries/use-intake-mutations";
import { DOCUMENT_TYPE_LABELS } from "@/components/intake-portal/labels";

/** Staff picks which upload slots the patient portal shows — "other" is always available as a catch-all, so it's not offered here. */
const REQUESTABLE_DOCUMENT_TYPES = [
  "insurance_card_front",
  "insurance_card_back",
  "drivers_license",
  "referral",
  "prior_record",
  "mammogram",
  "pap_smear",
] as const;

const formSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  dob: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(1, "Required"),
  newOrExisting: z.enum(["new", "existing"]),
  reasonForVisit: z.string().min(1, "Required"),
  providerId: z.string().optional(),
  scheduledDate: z.string().min(1, "Required"),
  scheduledTime: z.string().min(1, "Required"),
  notes: z.string().optional(),
  requiredDocumentTypes: z.array(z.string()),
  isTelehealth: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

/** Built from the staff's actual selections — always-required sections/consents plus whatever documents/telehealth they picked. */
function buildIntakeChecklist(values: FormValues): string[] {
  const items = ["Personal Information", "Medical History", "Insurance Information"];
  items.push(...values.requiredDocumentTypes.map((t) => `${DOCUMENT_TYPE_LABELS[t] ?? t} Upload`));
  items.push("Consent to Treat", "HIPAA Privacy Acknowledgement", "Financial Responsibility Agreement");
  if (values.isTelehealth) items.push("Telehealth Consent");
  return items;
}

const DEFAULT_VALUES: FormValues = {
  firstName: "",
  lastName: "",
  dob: "",
  email: "",
  phone: "",
  newOrExisting: "new",
  reasonForVisit: "",
  providerId: undefined,
  scheduledDate: "",
  scheduledTime: "",
  notes: "",
  requiredDocumentTypes: [],
  isTelehealth: false,
};

function toApiInput(values: FormValues, action: CreateIntakeInput["action"]): CreateIntakeInput {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    dob: values.dob,
    email: values.email,
    phone: values.phone,
    newOrExisting: values.newOrExisting,
    reasonForVisit: values.reasonForVisit,
    providerId: values.providerId || undefined,
    scheduledAt: new Date(`${values.scheduledDate}T${values.scheduledTime}`).toISOString(),
    notes: values.notes || undefined,
    requiredDocumentTypes: values.requiredDocumentTypes,
    isTelehealth: values.isTelehealth,
    action,
  };
}

export function CreateIntakeDialog({ onSuccess }: { onSuccess?: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "review">("form");
  const [formValues, setFormValues] = useState<FormValues | null>(null);
  const providersQuery = useProvidersQuery();
  const createIntake = useCreateIntakeMutation();

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: DEFAULT_VALUES });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setStep("form");
      form.reset(DEFAULT_VALUES);
      setFormValues(null);
      createIntake.reset();
    }
  }

  async function handleAction(action: CreateIntakeInput["action"]) {
    if (!formValues) return;
    await createIntake.mutateAsync(toApiInput(formValues, action));
    handleOpenChange(false);
    onSuccess?.(action === "save_draft" ? "Intake saved as draft." : "Intake created and email sent.");
  }

  const providerName = providersQuery.data?.find((p) => p.id === formValues?.providerId)?.name;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Create Intake</Button>
      </DialogTrigger>
      <DialogContent className={step === "review" ? "max-w-xl" : undefined}>
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>Create Intake</DialogTitle>
              <DialogDescription>Enter the basic appointment information to get started.</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit((values) => { setFormValues(values); setStep("review"); })} className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" {...form.register("firstName")} />
                  {form.formState.errors.firstName && (
                    <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" {...form.register("lastName")} />
                  {form.formState.errors.lastName && (
                    <p className="text-xs text-destructive">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="dob">Date of birth</Label>
                  <Input id="dob" type="date" {...form.register("dob")} />
                  {form.formState.errors.dob && (
                    <p className="text-xs text-destructive">{form.formState.errors.dob.message}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label>New / existing patient</Label>
                  <Select
                    value={form.watch("newOrExisting")}
                    onValueChange={(v) => form.setValue("newOrExisting", v as "new" | "existing")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New patient</SelectItem>
                      <SelectItem value="existing">Existing patient</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...form.register("email")} />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input id="phone" {...form.register("phone")} />
                  {form.formState.errors.phone && (
                    <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="reasonForVisit">Reason for visit</Label>
                <Input id="reasonForVisit" {...form.register("reasonForVisit")} />
                {form.formState.errors.reasonForVisit && (
                  <p className="text-xs text-destructive">{form.formState.errors.reasonForVisit.message}</p>
                )}
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
                    <Label htmlFor="scheduledDate">Appt. date</Label>
                    <Input id="scheduledDate" type="date" {...form.register("scheduledDate")} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="scheduledTime">Time</Label>
                    <Input id="scheduledTime" type="time" {...form.register("scheduledTime")} />
                  </div>
                </div>
              </div>
              {(form.formState.errors.scheduledDate || form.formState.errors.scheduledTime) && (
                <p className="text-xs text-destructive">Appointment date and time are required.</p>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea id="notes" {...form.register("notes")} />
              </div>

              <fieldset className="grid gap-2 rounded-md border border-border p-3">
                <legend className="px-1 text-sm font-medium">Documents to request</legend>
                <div className="grid grid-cols-2 gap-2">
                  {REQUESTABLE_DOCUMENT_TYPES.map((type) => (
                    <label key={type} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.watch("requiredDocumentTypes").includes(type)}
                        onCheckedChange={(checked) => {
                          const current = form.getValues("requiredDocumentTypes");
                          form.setValue(
                            "requiredDocumentTypes",
                            checked ? [...current, type] : current.filter((t) => t !== type),
                          );
                        }}
                      />
                      {DOCUMENT_TYPE_LABELS[type]}
                    </label>
                  ))}
                </div>
                <label className="flex cursor-pointer items-center gap-2 border-t border-border pt-2 text-sm">
                  <Checkbox checked={form.watch("isTelehealth")} onCheckedChange={(checked) => form.setValue("isTelehealth", checked)} />
                  This is a telehealth visit (adds Telehealth Consent)
                </label>
              </fieldset>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">Continue</Button>
              </DialogFooter>
            </form>
          </>
        )}

        {step === "review" && formValues && (
          <>
            <DialogHeader>
              <DialogTitle>Review Intake</DialogTitle>
              <DialogDescription>Confirm the details before creating the intake.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Patient Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name</span>
                    <div>
                      {formValues.firstName} {formValues.lastName}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">DOB</span>
                    <div>{formValues.dob}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email</span>
                    <div>{formValues.email}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone</span>
                    <div>{formValues.phone}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Patient type</span>
                    <div>
                      <Badge variant={formValues.newOrExisting === "new" ? "default" : "muted"}>
                        {formValues.newOrExisting === "new" ? "New" : "Existing"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Appointment Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Provider</span>
                    <div>{providerName ?? "No preference"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date & time</span>
                    <div>{new Date(`${formValues.scheduledDate}T${formValues.scheduledTime}`).toLocaleString()}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Reason for visit</span>
                    <div>{formValues.reasonForVisit}</div>
                  </div>
                  {formValues.notes && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Notes</span>
                      <div>{formValues.notes}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Patient Intake Preview</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <ul className="grid grid-cols-2 gap-1.5">
                    {buildIntakeChecklist(formValues).map((item) => (
                      <li key={item} className="flex items-center gap-1.5 text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {item}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Est. 8–10 minutes
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> {formValues.email}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {createIntake.isError && (
                <p className="text-sm text-destructive">{(createIntake.error as Error).message}</p>
              )}
            </div>

            <DialogFooter className="sm:justify-between">
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="outline" onClick={() => setStep("form")}>
                  Edit Intake
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={createIntake.isPending}
                  onClick={() => handleAction("save_draft")}
                >
                  Save as Draft
                </Button>
                <Button disabled={createIntake.isPending} onClick={() => handleAction("create_and_send")}>
                  Create Intake & Send Email
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
