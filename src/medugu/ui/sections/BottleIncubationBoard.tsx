// BottleIncubationBoard — read-only Epic Beaker-style incubation timeline.
//
// Renders a per-(set × bottle) row showing each day of the bottle's incubation
// window. The window length now varies by bottle type:
//   AEROBIC / ANAEROBIC / PAEDIATRIC = 5 d
//   MYCOLOGY                         = 14 d
//   MYCOBACTERIAL                    = 42 d
//   ISOLATOR                         = subcultured, no incubation grid
//
// Each cell shows the bottle's status for that day. For incubating cells we
// also surface the cumulative hours-on-instrument so the bench can read TTP-
// progress at a glance, mirroring how Beaker displays the BACTEC/BacT-Alert
// hours counter next to each bottle row. Pure presentation; no writes.

const HOURS_PER_DAY = 24;

const BOTTLE_LABEL: Record<string, string> = {
  AEROBIC: "Aerobic",
  ANAEROBIC: "Anaerobic",
  PAEDIATRIC: "Paediatric",
  MYCOLOGY: "Mycology",
  MYCOBACTERIAL: "Mycobacterial",
  ISOLATOR: "Isolator",
};

/** Maximum incubation window per bottle type, in days. 0 = no grid (e.g. isolator). */
const BOTTLE_MAX_DAYS: Record<string, number> = {
  AEROBIC: 5,
  ANAEROBIC: 5,
  PAEDIATRIC: 5,
  MYCOLOGY: 14,
  MYCOBACTERIAL: 42,
  ISOLATOR: 0,
};

/**
 * Bench-conventional bottle ordering (anaerobic first per draw-order teaching,
 * then aerobic, then paeds/specialty bottles). Used to sort rows in the board
 * so techs see a consistent layout across accessions.
 */
const BOTTLE_SORT_RANK: Record<string, number> = {
  ANAEROBIC: 0,
  AEROBIC: 1,
  PAEDIATRIC: 2,
  MYCOLOGY: 3,
  MYCOBACTERIAL: 4,
  ISOLATOR: 5,
};

function bottleSortKey(bottle: string): number {
  return BOTTLE_SORT_RANK[bottle] ?? 99;
}

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
  growth: string; // legacy: "pending" | "growth" | "no_growth"
  status?: string; // lifecycle: received|loaded|incubating|flagged_positive|removed|terminal_negative|discontinued
  positiveAt?: string;
  ttpHours?: number;
  loadedAt?: string;
  protocolDays?: number;
}

interface BottleIncubationBoardProps {
  sets: BoardSetRow[];
  bottleResults: BoardBottleResult[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maxDaysFor(bottle: string, override?: number): number {
  if (override && override > 0) return override;
  return BOTTLE_MAX_DAYS[bottle] ?? 5;
}

function buildDayList(maxDays: number): number[] {
  if (maxDays <= 0) return [];
  // Cap rendered columns to keep the table compact — for long protocols we
  // surface key milestones only (D1, D2, D3, D5, D7, D10, D14, D21, D28, D35, D42).
  if (maxDays <= 7) return Array.from({ length: maxDays }, (_, i) => i + 1);
  const milestones = [1, 2, 3, 5, 7, 10, 14, 21, 28, 35, 42];
  return milestones.filter((d) => d <= maxDays);
}

/**
 * Derives the approximate positive day (1-indexed) from ttpHours.
 * Falls back to (positiveAt − drawTime) when ttpHours is missing.
 */
function resolvePositiveDay(
  result: BoardBottleResult,
  set: BoardSetRow | undefined,
  maxDays: number,
): { day: number; approx: boolean; ttpHours?: number } | null {
  if (result.growth !== "growth") return null;

  if (result.ttpHours !== undefined && result.ttpHours >= 0) {
    const day = Math.min(Math.ceil(result.ttpHours / HOURS_PER_DAY) || 1, maxDays);
    return { day, approx: false, ttpHours: result.ttpHours };
  }

  // Prefer instrument time-on-bottle (loadedAt → positiveAt) per Beaker convention,
  // fall back to draw-to-positive when loadedAt is missing.
  const t0Source = result.loadedAt ?? set?.drawTime;
  if (t0Source && result.positiveAt) {
    const t0 = new Date(t0Source).getTime();
    const t1 = new Date(result.positiveAt).getTime();
    if (Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0) {
      const hours = Math.round(((t1 - t0) / 36e5) * 10) / 10;
      const day = Math.min(Math.ceil(hours / HOURS_PER_DAY) || 1, maxDays);
      return { day, approx: !result.loadedAt, ttpHours: hours };
    }
  }

  return { day: 1, approx: true, ttpHours: undefined };
}

// ---------------------------------------------------------------------------
// Cell rendering
// ---------------------------------------------------------------------------

type CellVariant =
  | "empty"        // bottle has no status for this column
  | "incubating"   // incubation window includes this day, no flag yet
  | "flagged"      // bottle flagged positive on this day
  | "removed"      // bottle was unloaded after positive flag
  | "no_growth"    // terminal negative on the final day
  | "pending_ng"   // earlier days for a no_growth bottle
  | "out_of_range"; // day is beyond this bottle's max incubation window

function getVariant(
  day: number,
  result: BoardBottleResult | undefined,
  positiveInfo: { day: number; approx: boolean; ttpHours?: number } | null,
  maxDays: number,
): CellVariant {
  if (day > maxDays) return "out_of_range";
  if (!result) return "empty";

  if (result.growth === "growth" && positiveInfo) {
    if (day === positiveInfo.day) return "flagged";
    if (day > positiveInfo.day) return "removed";
    return "incubating";
  }

  if (result.growth === "no_growth") {
    if (day === maxDays) return "no_growth";
    return "pending_ng";
  }

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
        wrapper: "rounded border border-destructive bg-destructive/10 px-1 py-0.5 text-center",
        label: "text-destructive font-semibold",
      };
    case "no_growth":
      return {
        wrapper: "rounded border border-border bg-muted/30 px-1 py-0.5 text-center",
        label: "text-muted-foreground",
      };
    case "removed":
      return {
        wrapper: "rounded border border-border bg-muted/20 px-1 py-0.5 text-center",
        label: "text-muted-foreground",
      };
    case "pending_ng":
    case "incubating":
      return {
        wrapper: "rounded border border-border px-1 py-0.5 text-center",
        label: "text-foreground",
      };
    case "out_of_range":
      return {
        wrapper: "px-1 py-0.5 text-center opacity-30",
        label: "text-muted-foreground",
      };
    case "empty":
    default:
      return {
        wrapper: "px-1 py-0.5 text-center",
        label: "text-muted-foreground",
      };
  }
}

/**
 * Cumulative hours-on-instrument estimate for a given column day.
 * For incubating cells we show the elapsed hours since draw at the END of that
 * column day (e.g. Day 3 → +72h), so the tech sees TTP progress per row.
 */
function cumulativeHoursLabel(day: number): string {
  return `+${day * HOURS_PER_DAY}h`;
}

function cellText(
  variant: CellVariant,
  positiveInfo: { day: number; approx: boolean; ttpHours?: number } | null,
  day: number,
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
      return cumulativeHoursLabel(day);
    case "out_of_range":
      return "·";
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
  maxDays: number,
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
      return `${bottleLabel}: terminal no growth at Day ${day} (${maxDays}-day protocol)`;
    case "removed":
      return `${bottleLabel}: unloaded from incubator after positive flag`;
    case "pending_ng":
    case "incubating":
      return `${bottleLabel}: incubating — approx. ${day * HOURS_PER_DAY} h on instrument by end of Day ${day}`;
    case "out_of_range":
      return `${bottleLabel}: outside ${maxDays}-day incubation window`;
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

  // Build sorted rows: anaerobic → aerobic → paeds → specialty.
  const rows: Array<{
    key: string;
    set: BoardSetRow;
    bottle: string;
    result: BoardBottleResult | undefined;
  }> = sets.flatMap((set) =>
    [...set.bottleTypes]
      .sort((a, b) => bottleSortKey(a) - bottleSortKey(b))
      .map((bottle) => ({
        key: `${set.setNo}-${bottle}`,
        set,
        bottle,
        result: bottleResults.find(
          (r) => r.setNo === set.setNo && r.bottleType === bottle,
        ),
      })),
  );

  // Determine the union of days across all rendered rows, so the header is
  // wide enough to cover the longest protocol present (e.g. a mycobacterial
  // bottle next to standard aerobic/anaerobic).
  const headerMaxDays = rows.reduce(
    (max, r) => Math.max(max, maxDaysFor(r.bottle)),
    0,
  );
  const headerDays = buildDayList(headerMaxDays);

  // Hide the board entirely if every bottle is no-grid (e.g. only ISOLATOR).
  if (headerDays.length === 0) return null;

  return (
    <div className="space-y-1">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Bottle incubation board
        </p>
        <p className="text-[10px] text-muted-foreground">
          Read-only timeline. Cells show approximate cumulative hours on instrument; window length varies by bottle type (5 d standard / 14 d mycology / 42 d AFB).
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
              <th className="p-1.5 text-center">Window</th>
              {headerDays.map((d) => (
                <th key={d} className="p-1.5 text-center">
                  D{d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, set, bottle, result }) => {
              const maxDays = maxDaysFor(bottle);
              const positiveInfo = resolvePositiveDay(
                result ?? { setNo: set.setNo, bottleType: bottle, growth: "pending" },
                set,
                maxDays,
              );
              const label = BOTTLE_LABEL[bottle] ?? bottle;
              const siteLabel = set.drawSite
                ? set.drawSite.replace(/_/g, " ").toLowerCase()
                : "—";
              const siteDisplay = set.lumenLabel
                ? `${siteLabel} · ${set.lumenLabel}`
                : siteLabel;

              // Special-case rows whose bottle type carries no incubation grid
              // (e.g. isolator → plated subculture).
              if (maxDays <= 0) {
                return (
                  <tr key={key} className="border-t border-border align-middle">
                    <td className="p-1.5 font-mono text-foreground">#{set.setNo}</td>
                    <td className="p-1.5 text-foreground">{label}</td>
                    <td className="p-1.5 text-muted-foreground">{siteDisplay}</td>
                    <td className="p-1.5 text-center text-[10px] text-muted-foreground">
                      Subcultured
                    </td>
                    <td
                      colSpan={headerDays.length}
                      className="p-1.5 text-[10px] italic text-muted-foreground"
                    >
                      No automated incubation — read by plate culture.
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={key} className="border-t border-border align-middle">
                  <td className="p-1.5 font-mono text-foreground">#{set.setNo}</td>
                  <td className="p-1.5 text-foreground">{label}</td>
                  <td className="p-1.5 text-muted-foreground">{siteDisplay}</td>
                  <td className="p-1.5 text-center text-[10px] text-muted-foreground">
                    {maxDays} d
                  </td>
                  {headerDays.map((day) => {
                    const variant = getVariant(day, result, positiveInfo, maxDays);
                    const styles = cellStyle(variant);
                    const text = cellText(variant, positiveInfo, day);
                    const title = cellTitle(variant, positiveInfo, day, label, maxDays);
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
