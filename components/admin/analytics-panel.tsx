import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAdminMoney } from "@/lib/admin/format";

export function AnalyticsPanel({
  signupsByDay,
  revenueByDay,
  topCreators,
}: {
  signupsByDay: { date: string; count: number }[];
  revenueByDay: { date: string; gross_kobo: number }[];
  topCreators: { creator_id: string; username: string; net_kobo: number }[];
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Signups (14 days)</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">New users</th>
              </tr>
            </thead>
            <tbody>
              {signupsByDay.map((row) => (
                <tr key={row.date} className="border-b last:border-0">
                  <td className="p-3">{row.date}</td>
                  <td className="p-3">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Gross revenue (14 days)</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Gross</th>
              </tr>
            </thead>
            <tbody>
              {revenueByDay.map((row) => (
                <tr key={row.date} className="border-b last:border-0">
                  <td className="p-3">{row.date}</td>
                  <td className="p-3">{formatAdminMoney(row.gross_kobo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Top creators by gross (14d)</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {topCreators.length === 0 ? (
                <li className="text-muted-foreground">No earnings data yet.</li>
              ) : (
                topCreators.map((c, i) => (
                  <li
                    key={c.creator_id}
                    className="flex min-w-0 justify-between gap-3 border-b py-2 last:border-0"
                  >
                    <span className="min-w-0 truncate">
                      {i + 1}. @{c.username}
                    </span>
                    <span className="shrink-0 font-medium">
                      {formatAdminMoney(c.net_kobo)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
