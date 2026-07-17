"use client";

import { Bell, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  StaffNotification,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useStaffNotificationsQuery,
} from "@/lib/queries/use-staff-notifications";

function NotificationRow({ notification, onRead }: { notification: StaffNotification; onRead: (id: string) => void }) {
  const isUnread = !notification.readAt;

  return (
    <button
      type="button"
      onClick={() => isUnread && onRead(notification.id)}
      className={cn(
        "flex w-full items-start gap-2 border-b border-border px-4 py-3 text-left text-sm last:border-b-0 hover:bg-muted",
        isUnread && "bg-primary/5",
      )}
    >
      <span
        className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", isUnread ? "bg-primary" : "bg-transparent")}
        aria-hidden
      />
      <div className="grid min-w-0 gap-0.5">
        <p className={cn("truncate", isUnread && "font-medium")}>{notification.message}</p>
        <p className="text-xs text-muted-foreground">{formatRelativeTime(notification.createdAt)}</p>
      </div>
    </button>
  );
}

export function NotificationBell() {
  const notificationsQuery = useStaffNotificationsQuery();
  const markRead = useMarkNotificationReadMutation();
  const markAllRead = useMarkAllNotificationsReadMutation();

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const notifications = notificationsQuery.data?.notifications ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" title="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs font-normal text-muted-foreground hover:text-foreground"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Mark all as read
            </Button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onRead={(id) => markRead.mutate(id)}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
