import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/interpret")({ component: InterpretPage });

function InterpretPage() {
  return <div className="p-4">Final AST interpretation requires authorised review</div>;
}
