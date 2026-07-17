"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z
  .object({
    noInsurance: z.boolean(),
    payerName: z.string().optional(),
    policyNumber: z.string().optional(),
    groupNumber: z.string().optional(),
    subscriberName: z.string().optional(),
    relationshipToSubscriber: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.noInsurance) return;
    for (const field of ["payerName", "policyNumber", "subscriberName", "relationshipToSubscriber"] as const) {
      if (!values[field]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: "Required unless you have no insurance" });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

function fromStoredData(data: Record<string, unknown> | undefined): FormValues {
  return {
    noInsurance: (data?.noInsurance as boolean) ?? false,
    payerName: (data?.payerName as string) ?? "",
    policyNumber: (data?.policyNumber as string) ?? "",
    groupNumber: (data?.groupNumber as string) ?? "",
    subscriberName: (data?.subscriberName as string) ?? "",
    relationshipToSubscriber: (data?.relationshipToSubscriber as string) ?? "",
  };
}

export function StepInsurance({
  initialData,
  onNext,
  onBack,
  saving,
}: {
  initialData: Record<string, unknown> | undefined;
  onNext: (data: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  saving: boolean;
}) {
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: fromStoredData(initialData) });
  const noInsurance = form.watch("noInsurance");

  return (
    <form onSubmit={form.handleSubmit((values) => onNext(values))} className="grid gap-5">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={noInsurance} onCheckedChange={(checked) => form.setValue("noInsurance", checked)} />
        I do not have health insurance (self-pay)
      </label>

      <fieldset disabled={noInsurance} className="grid gap-4 disabled:opacity-50">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="payerName">Insurance provider</Label>
            <Input id="payerName" {...form.register("payerName")} />
            {form.formState.errors.payerName && <p className="text-xs text-destructive">{form.formState.errors.payerName.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="policyNumber">Policy / member number</Label>
            <Input id="policyNumber" {...form.register("policyNumber")} />
            {form.formState.errors.policyNumber && (
              <p className="text-xs text-destructive">{form.formState.errors.policyNumber.message}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="groupNumber">Group number (optional)</Label>
            <Input id="groupNumber" {...form.register("groupNumber")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="subscriberName">Subscriber name</Label>
            <Input id="subscriberName" {...form.register("subscriberName")} />
            {form.formState.errors.subscriberName && (
              <p className="text-xs text-destructive">{form.formState.errors.subscriberName.message}</p>
            )}
          </div>
        </div>
        <div className="grid gap-1.5 sm:w-1/2">
          <Label htmlFor="relationshipToSubscriber">Your relationship to subscriber</Label>
          <Input id="relationshipToSubscriber" placeholder="e.g. Self, Spouse, Child" {...form.register("relationshipToSubscriber")} />
          {form.formState.errors.relationshipToSubscriber && (
            <p className="text-xs text-destructive">{form.formState.errors.relationshipToSubscriber.message}</p>
          )}
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
