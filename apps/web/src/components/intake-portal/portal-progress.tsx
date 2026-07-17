import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function PortalProgress({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  const percent = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          Step {currentStep + 1} of {steps.length}: {steps[currentStep]}
        </span>
        <span className="text-muted-foreground">{Math.round(percent)}%</span>
      </div>
      <Progress value={percent} />
      {/* Full step list — collapses out of the way on narrow phone screens, progress bar above still communicates position. */}
      <ol className="hidden gap-1 sm:flex sm:flex-wrap">
        {steps.map((step, i) => (
          <li
            key={step}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
              i === currentStep && "bg-primary text-primary-foreground",
              i < currentStep && "text-muted-foreground",
              i > currentStep && "text-muted-foreground/60",
            )}
          >
            {i < currentStep ? <Check className="h-3 w-3" /> : <span>{i + 1}.</span>}
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
