import { formatNgnFromKobo } from "@/lib/wallets/format";
import type { EarningsDailyRow } from "@/types/wallet";

export function EarningsTable({ rows }: { rows: EarningsDailyRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No earnings recorded in this period yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left">
            <th className="p-3 font-medium">Date</th>
            <th className="p-3 font-medium">Gross</th>
            <th className="p-3 font-medium">Fees</th>
            <th className="p-3 font-medium">Net</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date} className="border-b last:border-0">
              <td className="p-3">{row.date}</td>
              <td className="p-3">{formatNgnFromKobo(row.gross_kobo)}</td>
              <td className="p-3 text-muted-foreground">
                {formatNgnFromKobo(
                  row.platform_fee_kobo + row.payment_fee_kobo,
                )}
              </td>
              <td className="p-3 font-medium">
                {formatNgnFromKobo(row.net_kobo)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
