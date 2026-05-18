import type { SessionMessage } from "@anthropic-ai/claude-agent-sdk";
import { EngineEventHistoryRole } from "@angel-engine/client-napi";
import { describe, expect, it } from "vitest";
import { historyEventsFromSessionMessages } from "../history";

function sessionMessage(
  type: SessionMessage["type"],
  content: unknown,
): SessionMessage {
  return {
    message: { content },
    parent_tool_use_id: null,
    session_id: "session-1",
    type,
    uuid: "message-1",
  };
}

describe("Claude history replay", () => {
  it("skips unknown assistant and user block types", () => {
    const events = historyEventsFromSessionMessages("conversation-1", [
      sessionMessage("assistant", [
        { type: "server_tool_use", id: "tool-1" },
        { text: "hello", type: "text" },
      ]),
      sessionMessage("user", [
        { type: "unknown_user_block", value: true },
        { text: "thanks", type: "text" },
      ]),
    ]);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      HistoryReplayChunk: {
        entry: { role: EngineEventHistoryRole.Assistant },
      },
    });
    expect(events[1]).toMatchObject({
      HistoryReplayChunk: {
        entry: { role: EngineEventHistoryRole.User },
      },
    });
  });

  it("still rejects malformed known block types", () => {
    expect(() =>
      historyEventsFromSessionMessages("conversation-1", [
        sessionMessage("assistant", [{ type: "text", text: 1 }]),
      ]),
    ).toThrow("Claude assistant text history block is malformed.");
  });
});
