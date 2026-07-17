import { UserButton } from "@clerk/nextjs";
import { NotificationBell } from "@/components/notifications/notification-bell";

/**
 * Shared shell for staff-facing routes. Auth is already enforced by
 * middleware.ts before any of this renders — this layout just shows who's
 * signed in and gives them a way to sign out.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <span className="font-semibold">Atria Wellness</span>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <UserButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
