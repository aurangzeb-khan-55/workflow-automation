import { IntakePortalWizard } from "@/components/intake-portal/intake-portal-wizard";

/**
 * The secure, patient-facing intake portal — reached via the unique link
 * emailed at intake creation (INTAKE_LINK_BASE_URL/{secureToken}). No Clerk
 * session at all; the token itself is the credential (see the API's
 * IntakeTokenGuard). All data fetching/mutation happens client-side against
 * /api/v1/patient-intake/:token.
 */
export default async function IntakePortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 text-center sm:mb-8">
        <h1 className="text-lg font-semibold sm:text-xl">Welcome to Atria Wellness</h1>
        <p className="mt-1 text-sm text-muted-foreground">Please complete your intake before your upcoming appointment.</p>
      </div>
      <IntakePortalWizard token={token} />
    </main>
  );
}
