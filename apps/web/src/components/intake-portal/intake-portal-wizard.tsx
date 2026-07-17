"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import {
  MissingItem,
  useDeleteDocumentMutation,
  useIntakeQuery,
  useSaveSectionMutation,
  useSignConsentMutation,
  useSubmitIntakeMutation,
  useUploadDocumentMutation,
} from "@/lib/queries/use-patient-intake";
import { PortalProgress } from "./portal-progress";
import { StepPersonalInfo } from "./step-personal-info";
import { StepMedicalHistory } from "./step-medical-history";
import { StepInsurance } from "./step-insurance";
import { StepDocuments } from "./step-documents";
import { StepConsents } from "./step-consents";
import { MissingInfoBanner } from "./missing-info-banner";
import { ConfirmationScreen } from "./confirmation-screen";

const ALREADY_SUBMITTED_STATUSES = ["intake_submitted", "ready_for_staff_review", "uploaded_to_jane", "completed"];

type StepKey = "personal_info" | "medical_history" | "insurance_info" | "documents" | "consents";

const STEP_LABELS: Record<StepKey, string> = {
  personal_info: "Personal Info",
  medical_history: "Medical History",
  insurance_info: "Insurance",
  documents: "Documents",
  consents: "Consents",
};

function findSection(sections: { sectionType: string; data: Record<string, unknown> }[], type: string) {
  return sections.find((s) => s.sectionType === type)?.data;
}

export function IntakePortalWizard({ token }: { token: string }) {
  const intakeQuery = useIntakeQuery(token);
  const saveSectionMutation = useSaveSectionMutation(token);
  const uploadDocumentMutation = useUploadDocumentMutation(token);
  const deleteDocumentMutation = useDeleteDocumentMutation(token);
  const signConsentMutation = useSignConsentMutation(token);
  const submitIntakeMutation = useSubmitIntakeMutation(token);

  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [lastMissing, setLastMissing] = useState<MissingItem[] | null>(null);

  const intake = intakeQuery.data;
  const hasDocs = (intake?.requiredDocumentTypes.length ?? 0) > 0;

  const steps: StepKey[] = useMemo(() => {
    const s: StepKey[] = ["personal_info", "medical_history", "insurance_info"];
    if (hasDocs) s.push("documents");
    s.push("consents");
    return s;
  }, [hasDocs]);

  const stepComplete = useMemo(() => {
    if (!intake) return () => false;
    return (step: StepKey): boolean => {
      if (step === "documents") {
        return intake.requiredDocumentTypes.every((t) => intake.documents.some((d) => d.type === t));
      }
      if (step === "consents") {
        return intake.requiredConsentTypes.every((t) => intake.consents.some((c) => c.type === t));
      }
      return intake.sections.some((s) => s.sectionType === step);
    };
  }, [intake]);

  if (intakeQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your intake form…
      </div>
    );
  }

  if (intakeQuery.isError) {
    const err = intakeQuery.error;
    const status = err instanceof ApiError ? err.status : undefined;
    const message =
      status === 410
        ? "This intake link has expired. Please contact the clinic for a new one."
        : status === 404
          ? "We couldn't find an intake for this link. Please check the link and try again, or contact the clinic."
          : "Something went wrong loading your intake form. Please try again shortly.";
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">{message}</CardContent>
      </Card>
    );
  }

  if (!intake) return null;

  if (ALREADY_SUBMITTED_STATUSES.includes(intake.status)) {
    return <ConfirmationScreen patientFirstName={intake.patient?.firstName} />;
  }

  const resolvedStepIndex = stepIndex ?? Math.max(0, steps.findIndex((s) => !stepComplete(s)) === -1 ? steps.length - 1 : steps.findIndex((s) => !stepComplete(s)));
  const currentStep = steps[resolvedStepIndex];

  function goNext() {
    setStepIndex(Math.min(resolvedStepIndex + 1, steps.length - 1));
  }
  function goBack() {
    setStepIndex(Math.max(resolvedStepIndex - 1, 0));
  }

  async function handleSaveSection(sectionType: string, data: Record<string, unknown>) {
    await saveSectionMutation.mutateAsync({ sectionType, data });
    goNext();
  }

  async function handleSubmit() {
    // Narrowed above by `if (!intake) return null;` — TS doesn't carry that
    // narrowing into this nested function declaration on its own.
    const currentIntake = intake!;
    const result = await submitIntakeMutation.mutateAsync();
    setLastMissing(result.missing);
    if (result.missing.length > 0) {
      // Jump back to the first step that's still incomplete so the patient
      // isn't stuck staring at the consents screen wondering what's wrong.
      const firstIncomplete = steps.findIndex((s) => {
        if (s === "documents") {
          return currentIntake.requiredDocumentTypes.some((t) => !currentIntake.documents.some((d) => d.type === t));
        }
        if (s === "consents") {
          return currentIntake.requiredConsentTypes.some((t) => !currentIntake.consents.some((c) => c.type === t));
        }
        return !currentIntake.sections.some((sec) => sec.sectionType === s);
      });
      setStepIndex(firstIncomplete === -1 ? 0 : firstIncomplete);
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <PortalProgress steps={steps.map((s) => STEP_LABELS[s])} currentStep={resolvedStepIndex} />

      {intake.status === "missing_documents" && (
        <MissingInfoBanner
          missing={lastMissing ?? [{ category: "section", type: "general", message: "Please review each step below — some information is still needed." }]}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{STEP_LABELS[currentStep]}</CardTitle>
        </CardHeader>
        <CardContent>
          {currentStep === "personal_info" && (
            <StepPersonalInfo
              initialData={findSection(intake.sections, "personal_info")}
              onNext={(data) => handleSaveSection("personal_info", data)}
              saving={saveSectionMutation.isPending}
            />
          )}
          {currentStep === "medical_history" && (
            <StepMedicalHistory
              initialData={findSection(intake.sections, "medical_history")}
              onNext={(data) => handleSaveSection("medical_history", data)}
              onBack={goBack}
              saving={saveSectionMutation.isPending}
            />
          )}
          {currentStep === "insurance_info" && (
            <StepInsurance
              initialData={findSection(intake.sections, "insurance_info")}
              onNext={(data) => handleSaveSection("insurance_info", data)}
              onBack={goBack}
              saving={saveSectionMutation.isPending}
            />
          )}
          {currentStep === "documents" && (
            <StepDocuments
              requiredDocumentTypes={intake.requiredDocumentTypes}
              documents={intake.documents}
              onUpload={(documentType, file) => uploadDocumentMutation.mutateAsync({ documentType, file })}
              onDelete={(documentId) => deleteDocumentMutation.mutateAsync(documentId)}
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {currentStep === "consents" && (
            <StepConsents
              requiredConsentTypes={intake.requiredConsentTypes}
              consents={intake.consents}
              onSign={(consentType, signatureData) => signConsentMutation.mutateAsync({ consentType, signatureData })}
              onSubmit={handleSubmit}
              onBack={goBack}
              submitting={submitIntakeMutation.isPending}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
