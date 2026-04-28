// BottleIncubationBoard — read-only Epic Beaker-style incubation timeline.
//
// Renders a compact Day 1–5 grid above the per-bottle editing table so bench
// staff can see each bottle's incubation status, flagged-positive day/TTP, and
// terminal no-growth at a glance. Pure presentation layer; derives everything
// from the same props already available to BottleResultsEditor. No writes.

const INCUBATION_DAYS = [1, 2, 3, 4, 5] as const;
const HOURS_PER_DAY = 24;

const BOTTLE_LABEL: Record<string, string> = {
  AEROBIC: "Aerobic",
  ANAEROBIC: "Anaerobic",
  PAEDIATRIC: "Paediatric",
  MYCOLOGY: "Mycology",
  MYCOBACTERIAL: "Mycobacterial",
  ISOLATOR: "Isolator",
};

// ---------------------------------------------------------------------------
// Local types inferred from BottleResultsEditor data shape — no domain edits.
// ---------------------------------------------------------------------------

interface BoardSetRow {
  setNo: number;
  drawSite: string;
  lumenLabel?: string;
  bottleTypes: string[];
  drawTime?: string;
}

interface BoardBottleResult {
  setNo: number;
  bottleType: string;
  growth: string; // "pending" | "growth" | "no_growth"
  positiveAt?: string;
  ttpHours?: number;
}

interface BottleIncubationBoardProps {
  sets: BoardSetRow[];
  bottleResults: BoardBottleResult[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives the approximate positive day (1-indexed) from ttpHours.
 * If ttpHours is not available but positiveAt + drawTime are, fall back to
 * computing it here; the tooltip will note "approximate from draw time".
 */
function resolvePositiveDay(
  result: BoardBottleResult,
  set: BoardSetRow | undefined,
): { day: number; approx: boolean; ttpHours?: number } | null {
  if (result.growth !== "growth") return null;

  // Prefer stored ttpHours (already computed by the editor).
  if (result.ttpHours !== undefined && result.ttpHours >= 0) {
    const day = Math.min(Math.ceil(result.ttpHours / HOURS_PER_DAY) || 1, 5);
    return { day, approx: false, ttpHours: result.ttpHours };
  }

  // Fallback: derive from drawTime + positiveAt.
  if (set?.drawTime && result.positiveAt) {
    const t0 = new Date(set.drawTime).getTime();
    const t1 = new Date(result.positiveAt).getTime();
    if (Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0) {
      const hours = Math.round(((t1 - t0) / 36e5) * 10) / 10;
      const day = Math.min(Math.ceil(hours / HOURS_PER_DAY) || 1, 5);
      return { day, approx: true, ttpHours: hours };
    }
  }

  // growth=true but no timing data — mark Day 1 as unknown flag.
  return { day: 1, approx: true, ttpHours: undefined };
}

// ---------------------------------------------------------------------------
// Cell rendering
// ---------------------------------------------------------------------------

type CellVariant =
  | "empty"       // no metadata / set not started
  | "incubating"  // day is within incubation period, no flag yet
  | "flagged"     // this is the day the bottle flagged positive
  | "removed"     // bottle was removed from incubator after positive flag
  | "no_growth"   // bottle is confirmed no-growth (terminal negative)
  | "pending_ng"; // no_growth not yet terminal (earlier days for no_growth bottles)

function getVariant(
  day: number,
  result: BoardBottleResult | undefined,
  positiveInfo: { day: number; approx: boolean; ttpHours?: number } | null,
): CellVariant {
  if (!result) return "empty";

  if (result.growth === "growth" && positiveInfo) {
    if (day === positiveInfo.day) return "flagged";
    if (day > positiveInfo.day) return "removed";
    return "incubating";
  }

  if (result.growth === "no_growth") {
    // Terminal negative only on the last rendered day (Day 5).
    // Earlier days shown as incubating for no_growth bottles.
    if (day === INCUBATION_DAYS[INCUBATION_DAYS.length - 1]) return "no_growth";
    return "pending_ng";
  }

  // pending
  return "incubating";
}

interface CellStyleConfig {
  wrapper: string;
  label: string;
}

function cellStyle(variant: CellVariant): CellStyleConfig {
  switch (variant) {
    case "flagged":
      return {
        wrapper:
          "rounded border border-destructive bg-destructive/10 px-1 py-0.5 text-center",
        label: "text-destructive font-semibold",
      };
    case "no_growth":
      return {
        wrapper:
          "rounded border border-border bg-muted/30 px-1 py-0.5 text-center",
        label: "text-muted-foreground",
      };
    case "removed":
      return {
        wrapper:
          "rounded border border-border bg-muted/20 px-1 py-0.5 text-center",
        label: "text-muted-foreground",
      };
    case "pending_ng":
      return {
        wrapper: "rounded border border-border px-1 py-0.5 text-center",
        label: "text-muted-foreground",
      };
    case "incubating":
      return {
        wrapper: "rounded border border-border px-1 py-0.5 text-center",
        label: "text-foreground",
      };
    case "empty":
    default:
      return {
        wrapper: "px-1 py-0.5 text-center",
        label: "text-muted-foreground",
      };
  }
}

function cellText(
  variant: CellVariant,
  positiveInfo: { day: number; approx: boolean; ttpHours?: number } | null,
  _day: number,
): string {
  switch (variant) {
    case "flagged":
      return positiveInfo?.ttpHours !== undefined
        ? `+${positiveInfo.ttpHours}h`
        : "Flag";
    case "no_growth":
      return "No growth";
    case "removed":
      return "Removed";
    case "pending_ng":
    case "incubating":
      return "Incub.";
    case "empty":
    default:
      return "—";
  }
}

function cellTitle(
  variant: CellVariant,
  positiveInfo: { day: number; approx: boolean; ttpHours?: number } | null,
  day: number,
  bottleLabel: string,
): string {
  switch (variant) {
    case "flagged":
      if (positiveInfo?.ttpHours !== undefined) {
        const timing = positiveInfo.approx
          ? `approx. ${positiveInfo.ttpHours} h from draw time`
          : `${positiveInfo.ttpHours} h TTP`;
        return `${bottleLabel}: flagged positive on Day ${day} (${timing})`;
      }
      return `${bottleLabel}: flagged positive on Day ${day} (timing unavailable)`;
    case "no_growth":
      return `${bottleLabel}: terminal no growth at Day ${day}`;
    case "removed":
      return `${bottleLabel}: Bottle removed from automated incubation after positive flag.`;
    case "pending_ng":
      return `${bottleLabel}: incubating (no growth recorded at Day ${day})`;
    case "incubating":
      return `${bottleLabel}: incubating at Day ${day}`;
    case "empty":
    default:
      return `${bottleLabel}: no data`;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BottleIncubationBoard({
  sets,
  bottleResults,
}: BottleIncubationBoardProps) {
  if (sets.length === 0) return null;

  // Collect rows: one per (set x bottle).
  const rows: Array<{
    key: string;
    set: BoardSetRow;
    bottle: string;
    result: BoardBottleResult | undefined;
  }> = sets.flatMap((set) =>
    set.bottleTypes.map((bottle) => ({
      key: `${set.setNo}-${bottle}`,
      set,
      bottle,
      result: bottleResults.find(
        (r) => r.setNo === set.setNo && r.bottleType === bottle,
      ),
    })),
  );

  return (
    <div className="space-y-1">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Bottle incubation board
        </p>
        <p className="text-[10px] text-muted-foreground">
          Read-only timeline derived from existing bottle data
        </p>
      </div>

      {/* Grid table */}
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-[10px]">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-1.5 text-left">Set</th>
              <th className="p-1.5 text-left">Bottle</th>
              <th className="p-1.5 text-left">Site</th>
              {INCUBATION_DAYS.map((d) => (
                <th key={d} className="p-1.5 text-center">
                  Day {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, set, bottle, result }) => {
              const positiveInfo = resolvePositiveDay(
                result ?? { setNo: set.setNo, bottleType: bottle, growth: "pending" },
                set,
              );
              const label = BOTTLE_LABEL[bottle] ?? bottle;
              const siteLabel = set.drawSite
                ? set.drawSite.replace(/_/g, " ").toLowerCase()
                : "—";
              const siteDisplay = set.lumenLabel
                ? `${siteLabel} · ${set.lumenLabel}`
                : siteLabel;

              return (
                <tr key={key} className="border-t border-border align-middle">
                  <td className="p-1.5 font-mono text-foreground">#{set.setNo}</td>
                  <td className="p-1.5 text-foreground">{label}</td>
                  <td className="p-1.5 text-muted-foreground">{siteDisplay}</td>
                  {INCUBATION_DAYS.map((day) => {
                    const variant = getVariant(day, result, positiveInfo);
                    const styles = cellStyle(variant);
                    const text = cellText(variant, positiveInfo, day);
                    const title = cellTitle(variant, positiveInfo, day, label);
                    return (
                      <td key={day} className="p-1">
                        <span
                          className={styles.wrapper}
                          title={title}
                          aria-label={title}
                        >
                          <span className={`text-[10px] ${styles.label}`}>
                            {text}
                          </span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
