import { describe, expect, it } from "vitest";
import type {
  OperationalQueueCategory,
  OperationalQueueItem,
} from "../operationalDashboard";
import {
  SHOWCASE_OPEN_QUEUE_LIMIT,
  selectEssentialOpenQueueItems,
} from "../essentialOpenQueue";

function item(
  id: string,
  accessionId: string,
  category: OperationalQueueCategory,
): OperationalQueueItem {
  return {
    id,
    accessionId,
    targetAccessionId: accessionId,
    targetSection: "Dashboard",
    category,
    priority: category === "critical_result" ? "critical" : "review",
    reason: category,
    recommendedAction: "Review",
    ownerRole: "mixed",
    sourceModule: "Validation",
  };
}

describe("essential open queue selection", () => {
  it("keeps the showcase queue to six items", () => {
    const items = Array.from({ length: 30 }, (_, index) =>
      item(
        `item-${index}`,
        `accession-${index}`,
        index === 0 ? "critical_result" : "validation_warning",
      ),
    );

    expect(selectEssentialOpenQueueItems(items)).toHaveLength(
      SHOWCASE_OPEN_QUEUE_LIMIT,
    );
  });

  it("keeps one example from each major operational capability", () => {
    const items = [
      item("critical", "a1", "critical_result"),
      item("release", "a2", "release_blocker"),
      item("ipc", "a3", "ipc_high_priority"),
      item("ams", "a4", "ams_pending_approval"),
      item("validation", "a5", "validation_warning"),
      item("other", "a6", "routine_review"),
      item("duplicate-release", "a2", "phone_out"),
      item("extra-ipc", "a7", "ipc_action"),
    ];

    const selected = selectEssentialOpenQueueItems(items);
    const categories = new Set(selected.map((entry) => entry.category));

    expect(categories.has("critical_result")).toBe(true);
    expect(categories.has("release_blocker")).toBe(true);
    expect(categories.has("ipc_high_priority")).toBe(true);
    expect(categories.has("ams_pending_approval")).toBe(true);
    expect(categories.has("validation_warning")).toBe(true);
    expect(categories.has("routine_review")).toBe(true);
  });

  it("prefers different accessions over repeated alerts from one case", () => {
    const items = [
      item("critical", "same", "critical_result"),
      item("release", "same", "release_blocker"),
      item("phone", "same", "phone_out"),
      item("ipc", "ipc-case", "ipc_action"),
      item("ams", "ams-case", "ams_restricted"),
      item("validation", "validation-case", "validation_warning"),
      item("routine", "routine-case", "routine_review"),
      item("colonisation", "colonisation-case", "colonisation_follow_up"),
    ];

    const selected = selectEssentialOpenQueueItems(items);
    const uniqueAccessions = new Set(
      selected.map((entry) => entry.accessionId),
    );

    expect(uniqueAccessions.size).toBeGreaterThanOrEqual(5);
  });
});
