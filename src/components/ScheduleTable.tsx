import { fill, getI18n } from "@/lib/i18n";
import type { ScheduleRow } from "@/lib/schedule";
import { formatDate } from "@/lib/zones";

export async function ScheduleTable({ schedule, currentHours }: { schedule: ScheduleRow[]; currentHours: number | null }) {
  const { t, lang } = await getI18n();
  return (
    <div className="card overflow-hidden">
      <div className="p-4">
        <h3 className="font-semibold">{t.stats.upcoming}</h3>
        {currentHours == null && <p className="mt-1 text-xs text-muted">{t.stats.noHours}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2">{t.stats.task}</th>
              <th className="px-4 py-2">{t.stats.every}</th>
              <th className="px-4 py-2">{t.stats.last}</th>
              <th className="px-4 py-2">{t.stats.due}</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map(({ interval, lastHours, lastDate, dueAt, remaining }) => {
              const overdue = remaining != null && remaining < 0;
              return (
                <tr key={interval.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    {lang === "hu" ? interval.labelHu : interval.labelEn}
                    {(lang === "hu" ? interval.notesHu : interval.notesEn) && (
                      <p className="text-xs text-muted">{lang === "hu" ? interval.notesHu : interval.notesEn}</p>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted">{interval.intervalHours} h</td>
                  <td className="px-4 py-2 text-muted">
                    {lastHours != null || lastDate ? `${lastHours != null ? `${lastHours} h` : ""} ${formatDate(lastDate, lang)}` : t.stats.never}
                  </td>
                  <td className={`px-4 py-2 font-medium ${overdue ? "text-red-400" : remaining != null && remaining < 3 ? "text-amber-400" : ""}`}>
                    {dueAt != null && `${dueAt} h`}
                    {remaining != null && (
                      <span className="ml-1 text-xs font-normal">
                        ({overdue ? t.stats.overdue : fill(t.stats.inHours, { n: remaining })})
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
