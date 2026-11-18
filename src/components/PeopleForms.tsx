"use client";

import { useActionState, useState } from "react";
import { inviteGuest, removeGuest, type InviteState } from "@/app/profile/actions";
import { fill, useI18n } from "@/lib/i18n/client";
import { ConfirmButton } from "./ConfirmButton";
import { SubmitButton } from "./SubmitButton";

type Bike = { id: string; label: string };

export function InviteForm({ bikes, publicUrl }: { bikes: Bike[]; publicUrl: string | null }) {
  const { t } = useI18n();
  const [state, action] = useActionState<InviteState, FormData>(inviteGuest, {});
  const [copied, setCopied] = useState(false);

  async function send(email: string) {
    if (!publicUrl) return;
    const text = `${t.people.shareText} ${email}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "MotoLog", text, url: publicUrl });
        return;
      } catch {
        // cancelled – fall back to copying
      }
    }
    await navigator.clipboard.writeText(`${text}\n${publicUrl}`);
    setCopied(true);
  }

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="email" type="email" required autoComplete="off" placeholder={t.people.email} className="input" />
        <SubmitButton className="btn-primary shrink-0">{t.people.invite}</SubmitButton>
      </div>
      {bikes.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-xs text-muted">{t.people.share}:</span>
          {bikes.map((b) => (
            <label key={b.id} className="flex items-center gap-1.5">
              <input type="checkbox" name="share_bike" value={b.id} defaultChecked className="accent-amber-500" />
              {b.label}
            </label>
          ))}
          <select name="role" defaultValue="viewer" className="input w-auto py-1 text-sm">
            <option value="viewer">{t.people.viewer}</option>
            <option value="editor">{t.people.editor}</option>
          </select>
        </div>
      )}
      {state.ok && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          ✓ {fill(t.people.invited, { email: state.ok })}
          {publicUrl && (
            <button type="button" onClick={() => send(state.ok!)} className="btn-ghost py-1 text-xs">
              {copied ? `✓ ${t.people.copied}` : `📤 ${t.people.sendLink}`}
            </button>
          )}
        </div>
      )}
      {(state.error || state.errorKey) && (
        <p className="rounded-xl bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {state.errorKey ? t.people[state.errorKey] : fill(t.people.error, { message: state.error ?? "" })}
        </p>
      )}
    </form>
  );
}

export function RemoveGuest({ email }: { email: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState<InviteState, FormData>(() => removeGuest(email), {});
  return (
    <form action={action} className="flex flex-col items-end">
      <ConfirmButton message={fill(t.people.removeConfirm, { email })} className="text-xs text-muted hover:text-red-400">
        {t.people.remove}
      </ConfirmButton>
      {(state.error || state.errorKey) && (
        <span className="text-[11px] text-red-300">{state.errorKey ? t.people[state.errorKey] : fill(t.people.error, { message: state.error ?? "" })}</span>
      )}
    </form>
  );
}
