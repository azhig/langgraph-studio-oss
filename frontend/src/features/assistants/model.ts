import type { Assistant } from "@langchain/langgraph-sdk";

/**
 * Assistant created by the server from the graph code (`metadata.created_by === "system"`).
 * The reference shows it as `Default Configuration`: it cannot be renamed,
 * and editing is offered as creating a new assistant.
 */
export const isSystemAssistant = (a?: Assistant): boolean =>
  (a?.metadata as { created_by?: string } | undefined)?.created_by === "system";

/** Title in lists and the modal: `Default Configuration` or the name. */
export const assistantTitle = (a: Assistant): string =>
  isSystemAssistant(a) ? "Default Configuration" : (a.name ?? a.assistant_id);

/** Short label in the Chat mode header: `Default` or the name. */
export const assistantShortName = (a: Assistant): string =>
  isSystemAssistant(a) ? "Default" : (a.name ?? "Assistant");

/** The graph's system assistant, or any assistant of this graph if there is none. */
export function defaultAssistantFor(assistants: Assistant[], graphId: string): Assistant | undefined {
  return (
    assistants.find((a) => a.graph_id === graphId && isSystemAssistant(a)) ??
    assistants.find((a) => a.graph_id === graphId)
  );
}
