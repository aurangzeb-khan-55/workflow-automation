"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  street: z.string().min(1, "Required"),
  city: z.string().min(1, "Required"),
  state: z.string().min(1, "Required"),
  zip: z.string().min(1, "Required"),
  phone: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email address"),
  gender: z.string().optional(),
  preferredPharmacy: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function fromStoredData(data: Record<string, unknown> | undefined): FormValues {
  const address = (data?.address as Record<string, string> | undefined) ?? {};
  const emergencyContact = (data?.emergencyContact as Record<string, string> | undefined) ?? {};
  return {
    street: address.street ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    zip: address.zip ?? "",
    phone: (data?.phone as string) ?? "",
    email: (data?.email as string) ?? "",
    gender: (data?.gender as string) ?? "",
    preferredPharmacy: (data?.preferredPharmacy as string) ?? "",
    emergencyContactName: emergencyContact.name ?? "",
    emergencyContactPhone: emergencyContact.phone ?? "",
    emergencyContactRelationship: emergencyContact.relationship ?? "",
  };
}

function toStoredData(values: FormValues): Record<string, unknown> {
  return {
    address: { street: values.street, city: values.city, state: values.state, zip: values.zip },
    phone: values.phone,
    email: values.email,
    gender: values.gender || undefined,
    preferredPharmacy: values.preferredPharmacy || undefined,
    emergencyContact: {
      name: values.emergencyContactName || undefined,
      phone: values.emergencyContactPhone || undefined,
      relationship: values.emergencyContactRelationship || undefined,
    },
  };
}

export function StepPersonalInfo({
  initialData,
  onNext,
  saving,
}: {
  initialData: Record<string, unknown> | undefined;
  onNext: (data: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: fromStoredData(initialData) });

  return (
    <form onSubmit={form.handleSubmit((values) => onNext(toStoredData(values)))} className="grid gap-5">
      <div className="grid gap-1.5">
        <Label htmlFor="street">Street address</Label>
        <Input id="street" autoComplete="street-address" {...form.register("street")} />
        {form.formState.errors.street && <p className="text-xs text-destructive">{form.formState.errors.street.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" autoComplete="address-level2" {...form.register("city")} />
          {form.formState.errors.city && <p className="text-xs text-destructive">{form.formState.errors.city.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="state">State</Label>
          <Input id="state" autoComplete="address-level1" {...form.register("state")} />
          {form.formState.errors.state && <p className="text-xs text-destructive">{form.formState.errors.state.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="zip">ZIP code</Label>
          <Input id="zip" inputMode="numeric" autoComplete="postal-code" {...form.register("zip")} />
          {form.formState.errors.zip && <p className="text-xs text-destructive">{form.formState.errors.zip.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" {...form.register("phone")} />
          {form.formState.errors.phone && <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
          {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Gender</Label>
          <Select value={form.watch("gender") || undefined} onValueChange={(v) => form.setValue("gender", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Prefer not to say" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="non_binary">Non-binary</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="preferredPharmacy">Preferred pharmacy</Label>
          <Input id="preferredPharmacy" placeholder="Optional" {...form.register("preferredPharmacy")} />
        </div>
      </div>

      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">Emergency contact</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="emergencyContactName">Name</Label>
            <Input id="emergencyContactName" {...form.register("emergencyContactName")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="emergencyContactPhone">Phone</Label>
            <Input id="emergencyContactPhone" type="tel" inputMode="tel" {...form.register("emergencyContactPhone")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="emergencyContactRelationship">Relationship</Label>
            <Input id="emergencyContactRelationship" {...form.register("emergencyContactRelationship")} />
          </div>
        </div>
      </fieldset>

      <Button type="submit" disabled={saving} className="w-full sm:w-auto sm:justify-self-end">
        {saving ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
