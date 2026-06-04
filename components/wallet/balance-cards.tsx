import { Card } from "@/components/ui/card";
import { formatNgnFromKobo } from "@/lib/wallets/format";
import { EARNINGS_CLEARANCE_DAYS } from "@/lib/wallets/constants";
import type { WalletSummary } from "@/types/wallet";

export function BalanceCards({
  wallet,
  earnings30dNet,
}: {
  wallet: WalletSummary | null;
  earnings30dNet?: number;
}) {
  const available = wallet?.available_kobo ?? 0;
  const pending = wallet?.pending_kobo ?? 0;
  const lifetime = wallet?.lifetime_credited_kobo ?? 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">Available</p>
        <p className="mt-1 text-2xl font-bold">{formatNgnFromKobo(available)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Ready to withdraw</p>
      </Card>
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">Pending clearance</p>
        <p className="mt-1 text-2xl font-bold">{formatNgnFromKobo(pending)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Clears after {EARNINGS_CLEARANCE_DAYS} days
        </p>
      </Card>
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">Lifetime earned</p>
        <p className="mt-1 text-2xl font-bold">{formatNgnFromKobo(lifetime)}</p>
      </Card>
      {earnings30dNet !== undefined ? (
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Net (30 days)</p>
          <p className="mt-1 text-2xl font-bold">
            {formatNgnFromKobo(earnings30dNet)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">After platform fees</p>
        </Card>
      ) : null}
    </div>
  );
}
