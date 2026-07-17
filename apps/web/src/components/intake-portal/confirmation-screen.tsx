import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ConfirmationScreen({ patientFirstName }: { patientFirstName?: string }) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="grid gap-3 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h1 className="text-xl font-semibold">
          Thank you{patientFirstName ? `, ${patientFirstName}` : ""} — your intake is complete
        </h1>
        <p className="text-sm text-muted-foreground">
          We&rsquo;ve received your information and it&rsquo;s been sent to your care team for review before your appointment.
          There&rsquo;s nothing further you need to do right now.
        </p>
        <p className="text-xs text-muted-foreground">You can safely close this page.</p>
      </CardContent>
    </Card>
  );
}
