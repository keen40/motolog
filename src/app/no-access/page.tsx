import { Logo } from "@/components/Header";
import { headers } from "next/headers";
import { authMode } from "@/lib/auth";
import { accessConfig } from "@/lib/cfAccess";
import { getI18n } from "@/lib/i18n";

export default async function NoAccessPage() {
  const { t } = await getI18n();
  const mode = authMode();
  const cf = accessConfig();
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
  const publicRoute = !!cf && host === cf.publicHost;
  return (
    <div className="mx-auto max-w-md py-16">
      <div className="card space-y-3 p-6 text-center">
        <Logo className="mx-auto h-10 w-10" />
        <h1 className="text-xl font-semibold">{t.noAccess.title}</h1>
        <p className="text-sm text-muted">{publicRoute ? t.noAccess.public : mode === "header" ? t.noAccess.sso : t.noAccess.tailscale}</p>
      </div>
    </div>
  );
}
