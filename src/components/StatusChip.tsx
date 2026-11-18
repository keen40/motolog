export function StatusChip({ status, label }: { status: string; label: string }) {
  const cls =
    status === "done" ? "bg-emerald-950/60 text-emerald-300" : status === "failed" ? "bg-red-950/60 text-red-300" : "bg-amber-950/60 text-amber-300";
  return <span className={`chip ${cls}`}>{label}</span>;
}
