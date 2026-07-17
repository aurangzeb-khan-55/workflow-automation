"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PortalConsent } from "@/lib/queries/use-patient-intake";
import { SignaturePad } from "./signature-pad";
import { CONSENT_TYPE_TEXT, consentTypeLabel } from "./labels";

function ConsentCard({
  consentType,
  signedAt,
  onSign,
}: {
  consentType: string;
  signedAt: string | null;
  onSign: (consentType: string, signatureData: string) => Promise<unknown>;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  async function handleSign() {
    if (!signature) return;
    setSigning(true);
    try {
      await onSign(consentType, signature);
    } finally {
      setSigning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {consentTypeLabel(consentType)}
          {signedAt && (
            <span className="flex items-center gap-1 text-xs font-normal text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" /> Signed {new Date(signedAt).toLocaleDateString()}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">{CONSENT_TYPE_TEXT[consentType] ?? "Please review and sign below."}</p>
        <SignaturePad onChange={setSignature} />
        <Button type="button" size="sm" disabled={!signature || signing} onClick={handleSign} className="justify-self-start">
          {signing ? "Signing…" : signedAt ? "Re-sign" : "Sign"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function StepConsents({
  requiredConsentTypes,
  consents,
  onSign,
  onSubmit,
  onBack,
  submitting,
}: {
  requiredConsentTypes: string[];
  consents: PortalConsent[];
  onSign: (consentType: string, signatureData: string) => Promise<unknown>;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}) {
  const signedTypes = new Set(consents.map((c) => c.type));
  const allSigned = requiredConsentTypes.every((t) => signedTypes.has(t));

  return (
    <div className="grid gap-5">
      {requiredConsentTypes.map((type) => (
        <ConsentCard
          key={type}
          consentType={type}
          signedAt={consents.find((c) => c.type === type)?.signedAt ?? null}
          onSign={onSign}
        />
      ))}

      {!allSigned && <p className="text-xs text-muted-foreground">Please sign every consent above to continue.</p>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" disabled={!allSigned || submitting} onClick={onSubmit}>
          {submitting ? "Submitting…" : "Submit Intake"}
        </Button>
      </div>
    </div>
  );
}
