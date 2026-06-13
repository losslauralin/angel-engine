import type { Metadata } from "next";

import HomePage from "./home-page";

export const metadata: Metadata = {
  description:
    "Angel Engine is a desktop app for Codex, OpenCode, and Claude Code chats, with project-aware threads, tool calls, and agent settings in one focused client.",
  title: "Angel Engine - Desktop Chat for Coding Agents",
};

export default function Page() {
  return <HomePage />;
}
