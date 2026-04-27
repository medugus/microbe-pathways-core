interface Props {
  canSubmit: boolean;
  submitBlockedReason: string | null;
}

export function SubmitBlockedReason({ canSubmit, submitBlockedReason }: Props) {
  if (canSubmit || !submitBlockedReason) return null;
  return <p className="mr-auto text-[11px] text-destructive">{submitBlockedReason}</p>;
}
