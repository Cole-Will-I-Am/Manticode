import type { ChatMessage } from "./ai.js";

interface FileContext {
  path: string;
  content: string;
  language?: string | null;
}

const MAX_CONTEXT_CHARS = 60_000;

const SYSTEM_PROMPT = `You are Manticode, an expert AI coding assistant inside Telegram. You help users write, debug, refactor, and understand code.

## Capabilities
- Read and analyze files in the user's project
- Suggest code changes as structured patches
- Explain code, algorithms, and architectural decisions
- Write tests, documentation, and configuration files

## Code Changes
When suggesting code changes, use this format:

\`\`\`<language> // <file_path>
<full file content or relevant section>
\`\`\`

For modifications to existing files, include enough surrounding context to identify where changes should be applied.

## Guidelines
- Be concise but thorough
- Explain reasoning briefly
- Prefer simple, idiomatic solutions
- Consider edge cases and error handling
- Follow the project's existing patterns and conventions`;

export function buildMessages(
  history: ChatMessage[],
  userMessage: string,
  files: FileContext[],
): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  // Attach file context
  if (files.length > 0) {
    const section = files
      .map((f) => `### ${f.path}\n\`\`\`${f.language || ""}\n${f.content}\n\`\`\``)
      .join("\n\n");

    messages.push({ role: "system", content: `## Project Files\n\n${section}` });
  }

  // Token budget — truncate oldest history first
  let budget = MAX_CONTEXT_CHARS;
  for (const msg of messages) budget -= msg.content.length;

  const truncated: ChatMessage[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (budget - msg.content.length < 0) break;
    budget -= msg.content.length;
    truncated.unshift(msg);
  }

  messages.push(...truncated);
  messages.push({ role: "user", content: userMessage });

  return messages;
}
