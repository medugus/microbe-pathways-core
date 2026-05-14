import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/qc-plate")({ component: QcPlatePage });

function QcPlatePage() {
  return <div className="p-4">Draft: not for clinical release</div>;
}
