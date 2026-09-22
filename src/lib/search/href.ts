/** Chat handoff for notes checked in EvidencePicker. */
export function evidenceChatHref(ids: readonly string[]): string {
  const params = new URLSearchParams();
  for (const id of ids) {
    if (id) params.append("evidence", id);
  }
  const qs = params.toString();
  return qs ? `/chat?${qs}` : "/chat";
}
