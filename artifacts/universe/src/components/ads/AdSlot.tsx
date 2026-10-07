import { useEffect, useRef } from "react";
import { AD_CLIENT, AD_SLOTS, loadAdSenseScript, pushAd, type AdSlotKey } from "@/lib/ads";

type AdSlotProps = {
  slot: AdSlotKey;
  className?: string;
};

export default function AdSlot({ slot, className }: AdSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const slotId = AD_SLOTS[slot];
  const configured = typeof slotId === "string" && slotId !== "REPLACE_WITH_SLOT_ID";

  useEffect(() => {
    if (!configured || !ref.current) return;
    let cancelled = false;
    loadAdSenseScript()
      .then(() => {
        if (!cancelled && ref.current) pushAd();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [configured]);

  if (!configured) return null;

  return (
    <div ref={ref} className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", minHeight: 100, textAlign: "center" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}