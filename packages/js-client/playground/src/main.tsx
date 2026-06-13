import type {
  Chat,
  ChatHistoryMessage,
  ChatHistoryMessagePart,
  ChatStreamEvent,
} from "@angel-engine/js-client";
import { AngelClient } from "@angel-engine/js-client";
import { MockAgentAdapter } from "@angel-engine/js-client/mock";
import { StrictMode, useEffect, useMemo, useReducer } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const client = new AngelClient({
  adapters: [new MockAgentAdapter({ delayMs: 55 })],
  defaultRuntime: "mock",
});

void client.projects.create({
  id: "playground",
  path: "/mock/playground",
});

interface PlaygroundState {
  activeChatId?: string;
  chats: Chat[];
  events: ChatStreamEvent[];
  isRunning: boolean;
  messages: ChatHistoryMessage[];
  prompt: string;
}

type PlaygroundAction =
  | { event: ChatStreamEvent; type: "append-event" }
  | {
      activeChatId?: string;
      chats: Chat[];
      messages: ChatHistoryMessage[];
      type: "refresh";
    }
  | { type: "reset-local" }
  | { chatId?: string; type: "set-active-chat" }
  | { events: ChatStreamEvent[]; type: "set-events" }
  | { prompt: string; type: "set-prompt" }
  | { running: boolean; type: "set-running" };

const initialPlaygroundState: PlaygroundState = {
  chats: [],
  events: [],
  isRunning: false,
  messages: [],
  prompt: "Show me how the JS client streams a mock agent run.",
};

function playgroundReducer(
  state: PlaygroundState,
  action: PlaygroundAction,
): PlaygroundState {
  switch (action.type) {
    case "append-event":
      return { ...state, events: [...state.events, action.event] };
    case "refresh":
      return {
        ...state,
        activeChatId: action.activeChatId,
        chats: action.chats,
        messages: action.messages,
      };
    case "reset-local":
      return {
        ...state,
        activeChatId: undefined,
        events: [],
      };
    case "set-active-chat":
      return { ...state, activeChatId: action.chatId };
    case "set-events":
      return { ...state, events: action.events };
    case "set-prompt":
      return { ...state, prompt: action.prompt };
    case "set-running":
      return { ...state, isRunning: action.running };
  }
}

function App() {
  const [state, dispatch] = useReducer(
    playgroundReducer,
    initialPlaygroundState,
  );
  const { activeChatId, chats, events, isRunning, messages, prompt } = state;

  useEffect(() => {
    return client.subscribe(() => {
      void refresh();
    });
  }, []);

  async function refresh(chatId?: string | null) {
    const nextChats = await client.chats.list();
    const selectedChatId =
      chatId === null
        ? undefined
        : (chatId ?? activeChatId ?? nextChats[0]?.id);
    dispatch({
      activeChatId: selectedChatId,
      chats: nextChats,
      messages: selectedChatId
        ? (await client.chats.load(selectedChatId)).messages
        : [],
      type: "refresh",
    });
  }

  async function sendPrompt() {
    const text = prompt.trim();
    if (!text || isRunning) return;

    dispatch({ running: true, type: "set-running" });
    dispatch({ events: [], type: "set-events" });
    try {
      const result = await client.chats.send(
        {
          chatId: activeChatId,
          projectId: "playground",
          runtime: "mock",
          text,
        },
        (event: ChatStreamEvent) => {
          dispatch({ event, type: "append-event" });
          if (event.type === "chat") {
            dispatch({ chatId: event.chat.id, type: "set-active-chat" });
          }
        },
      );
      dispatch({ chatId: result.chatId, type: "set-active-chat" });
      await refresh(result.chatId);
    } finally {
      dispatch({ running: false, type: "set-running" });
    }
  }

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId),
    [activeChatId, chats],
  );

  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">Angel Engine</p>
          <h1>JS Client Playground</h1>
        </div>
        <button
          onClick={() => {
            void client.chats.deleteAll().then(() => {
              dispatch({ type: "reset-local" });
              void refresh(null);
            });
          }}
          type="button"
        >
          Reset
        </button>
      </section>

      <section className="layout">
        <aside className="sidebar">
          <h2>Chats</h2>
          {chats.length === 0 ? (
            <p className="muted">No chats yet.</p>
          ) : (
            <div className="chat-list">
              {chats.map((chat) => (
                <button
                  className={chat.id === activeChatId ? "selected" : ""}
                  key={chat.id}
                  onClick={() => {
                    dispatch({ chatId: chat.id, type: "set-active-chat" });
                    void refresh(chat.id);
                  }}
                  type="button"
                >
                  <span>{chat.title}</span>
                  <small>{chat.runtime}</small>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="thread">
          <div className="thread-header">
            <div>
              <h2>{activeChat?.title ?? "Draft chat"}</h2>
              <p className="muted">Pure frontend mock adapter, no backend.</p>
            </div>
            <span className={isRunning ? "status running" : "status"}>
              {isRunning ? "Streaming" : "Idle"}
            </span>
          </div>

          <div className="messages" aria-live="polite">
            {messages.length === 0 ? (
              <p className="empty">Send a prompt to create a chat run.</p>
            ) : (
              messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <strong>{message.role}</strong>
                  <div>{message.content.map(renderPart)}</div>
                </article>
              ))
            )}
          </div>

          <div className="composer">
            <textarea
              onChange={(event) =>
                dispatch({ prompt: event.target.value, type: "set-prompt" })
              }
              value={prompt}
            />
            <button
              disabled={isRunning || !prompt.trim()}
              onClick={() => void sendPrompt()}
              type="button"
            >
              Send
            </button>
          </div>
        </section>

        <aside className="events">
          <h2>Stream Events</h2>
          <div className="event-list">
            {events.map((event) => (
              <pre key={streamEventKey(event)}>
                {JSON.stringify(event, null, 2)}
              </pre>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function renderPart(part: ChatHistoryMessagePart) {
  const key = chatPartKey(part);
  switch (part.type) {
    case "reasoning":
      return (
        <p className="reasoning" key={key}>
          {part.text}
        </p>
      );
    case "text":
      return <p key={key}>{part.text}</p>;
    case "data":
      return (
        <pre className="data" key={key}>
          {JSON.stringify(part.data, null, 2)}
        </pre>
      );
    case "tool-call":
      return (
        <pre className="tool" key={key}>
          {part.toolName}: {String(part.result ?? part.argsText)}
        </pre>
      );
  }
}

function chatPartKey(part: ChatHistoryMessagePart) {
  switch (part.type) {
    case "data":
      return `data:${JSON.stringify(part.data)}`;
    case "reasoning":
    case "text":
      return `${part.type}:${part.text}`;
    case "tool-call":
      return `tool:${part.toolName}:${part.argsText}:${JSON.stringify(part.result)}`;
  }
}

function streamEventKey(event: ChatStreamEvent) {
  return `${event.type}:${JSON.stringify(event)}`;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
