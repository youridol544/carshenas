'use client';

import { Switch } from '@base-ui/react/switch';
import { startTransition, useId, useLayoutEffect, useOptimistic, useState } from 'react';
import { ToastMessage, type ToastNotice } from '@/components/ui/toast-message';
import { setNotificationKindMutedAction } from '@/features/notifications/notifications-actions';
import { NOTIFICATIONS_COPY } from '@/features/notifications/notifications-copy';
import type { KindSetting } from '@/features/notifications/notifications-types';

// Which kinds of notification the buyer gets (CS-68 #4, ADR-0026 point 4): one switch per kind, on unless muted. A
// switch takes effect at once, optimistically (ui-design craft.md, section 4: no confirmation, a visible rollback): the
// action sets the target state, and a failure puts the switch back and says so in an overlay with a retry.

export function NotificationSettings({ settings }: { settings: KindSetting[] }) {
  const headingId = useId();
  const [failure, setFailure] = useState<ToastNotice | null>(null);
  useLayoutEffect(
    () => () => {
      setFailure(null);
    },
    [],
  );
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-heading font-bold">
        {NOTIFICATIONS_COPY.settings.heading}
      </h2>
      <p className="text-secondary text-pretty text-muted">{NOTIFICATIONS_COPY.settings.lead}</p>
      <ul className="rounded-card border border-divider bg-surface">
        {settings.map((setting) => (
          <KindSwitch
            key={setting.kind}
            setting={setting}
            onFailure={(message, retry) => {
              setFailure({ message, actionLabel: NOTIFICATIONS_COPY.retry, onAction: retry });
            }}
            onAttempt={() => {
              setFailure(null);
            }}
          />
        ))}
      </ul>
      <ToastMessage
        notice={failure}
        dismissLabel={NOTIFICATIONS_COPY.dismiss}
        onDismiss={() => {
          setFailure(null);
        }}
      />
    </section>
  );
}

type KindSwitchProps = {
  setting: KindSetting;
  onAttempt: () => void;
  onFailure: (message: string, retry: () => void) => void;
};

function KindSwitch({ setting, onAttempt, onFailure }: KindSwitchProps) {
  const [receiving, setReceiving] = useOptimistic(!setting.muted);
  const labelId = useId();
  const descriptionId = useId();

  function change(next: boolean) {
    onAttempt();
    startTransition(async () => {
      setReceiving(next);
      const retry = () => {
        change(next);
      };
      try {
        const result = await setNotificationKindMutedAction({ kind: setting.kind, muted: !next });
        if (result.status === 'failed') onFailure(result.message, retry);
      } catch {
        onFailure(NOTIFICATIONS_COPY.failures.mute, retry);
      }
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span id={labelId} className="text-control font-semibold text-default">
          {setting.label}
        </span>
        <span id={descriptionId} className="text-secondary text-pretty text-muted">
          {setting.description}
        </span>
      </div>
      <Switch.Root
        checked={receiving}
        onCheckedChange={change}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        // A 48 × 28 px track with a hit area grown to 64 × 48 px (ui-design craft.md, section 5).
        className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-control bg-surface-pressed p-0.5 transition-colors after:absolute after:-inset-x-2 after:-inset-y-2.5 data-checked:border-action data-checked:bg-action"
      >
        {/* On moves the thumb towards the inline end, which in this right-to-left app is the left: translate does not
            flip by itself, so the direction is negative on purpose (ui-design SKILL.md, point 2). */}
        <Switch.Thumb className="size-5 rounded-full bg-canvas shadow-raised transition-transform duration-press data-checked:-translate-x-5" />
      </Switch.Root>
    </li>
  );
}
