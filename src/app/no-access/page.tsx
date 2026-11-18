import { Logo } from "@/components/Header";
import { authMode } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";

export default async function NoAccessPage() {
  const { t } = await getI18n();
  const mode = authMode();
  return (
    <div className="mx-auto max-w-md py-16">
      <div className="card space-y-3 p-6 text-center">
        <Logo className="mx-auto h-10 w-10" />
        <h1 className="text-xl font-semibold">{t.noAccess.title}</h1>
        <p className="text-sm text-muted">{mode === "header" ? t.noAccess.sso : t.noAccess.tailscale}</p>
      </div>
    </div>
  );
}
