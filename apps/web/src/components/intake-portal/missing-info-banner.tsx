import { AlertTriangle } from "lucide-react";
import type { MissingItem } from "@/lib/queries/use-patient-intake";

export function MissingInfoBanner({ missing }: { missing: MissingItem[] }) {
  if (missing.length === 0) return null;

  return (
    <div className="flex gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
      <div className="grid gap-1">
        <p className="font-medium text-destructive">A few things are still needed before this can be submitted:</p>
        <ul className="list-disc pl-4 text-destructive/90">
          {missing.map((item, i) => (
            <li key={`${item.category}-${item.type}-${i}`}>{item.message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
