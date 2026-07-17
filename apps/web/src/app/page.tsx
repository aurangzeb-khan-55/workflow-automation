import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Atria Wellness Intake Platform</h1>
        <p className="text-muted-foreground">
          Staff dashboard and patient intake portal — scaffold in progress.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/dashboard">Staff Dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
