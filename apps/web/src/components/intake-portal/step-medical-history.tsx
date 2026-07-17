"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  conditions: z.string(),
  surgicalHistory: z.string(),
  medications: z.string(),
  allergies: z.string(),
  familyHistory: z.string(),
  socialHistory: z.string(),
});

type FormValues = z.infer<typeof schema>;

function toList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toText(list: unknown): string {
  return Array.isArray(list) ? list.join(", ") : "";
}

function fromStoredData(data: Record<string, unknown> | undefined): FormValues {
  return {
    conditions: toText(data?.conditions),
    surgicalHistory: toText(data?.surgicalHistory),
    medications: toText(data?.medications),
    allergies: toText(data?.allergies),
    familyHistory: toText(data?.familyHistory),
    socialHistory: toText(data?.socialHistory),
  };
}

function toStoredData(values: FormValues): Record<string, unknown> {
  return {
    conditions: toList(values.conditions),
    surgicalHistory: toList(values.surgicalHistory),
    medications: toList(values.medications),
    allergies: toList(values.allergies),
    familyHistory: toList(values.familyHistory),
    socialHistory: toList(values.socialHistory),
  };
}

const FIELDS: { name: keyof FormValues; label: string; placeholder: string }[] = [
  { name: "conditions", label: "Existing medical conditions", placeholder: "e.g. Hypertension, Type 2 Diabetes" },
  { name: "surgicalHistory", label: "Surgical history", placeholder: "e.g. Appendectomy (2015)" },
  { name: "medications", label: "Current medications", placeholder: "e.g. Lisinopril 10mg daily" },
  { name: "allergies", label: "Allergies", placeholder: "e.g. Penicillin, Peanuts" },
  { name: "familyHistory", label: "Family medical history", placeholder: "e.g. Diabetes (mother), Heart disease (father)" },
  { name: "socialHistory", label: "Social history", placeholder: "e.g. Non-smoker, occasional alcohol use" },
];

export function StepMedicalHistory({
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

  return (
    <form onSubmit={form.handleSubmit((values) => onNext(toStoredData(values)))} className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        List items separated by commas. If none apply, leave the field blank — &ldquo;none reported&rdquo; is a valid answer.
      </p>
      {FIELDS.map((field) => (
        <div key={field.name} className="grid gap-1.5">
          <Label htmlFor={field.name}>{field.label}</Label>
          <Textarea id={field.name} placeholder={field.placeholder} rows={2} {...form.register(field.name)} />
        </div>
      ))}

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
