## Coral9 tickets

This repo is Coral9 project `inside-karachi-backend-restructure-react-native-app`. The connection is pinned to it, so you can omit `project` on every call. The `coral9` MCP server is connected and acts as the developer whose token it holds.

**No untracked work.** Every task that changes code, config, content or deliverables maps to a ticket, and the ticket reflects reality. Small changes are not an exception.

### Before changing anything
1. `search_tickets` with a few key words from the task.
2. A matching open ticket exists: `start_work` with its number. That assigns you and moves it to In Progress.
3. Nothing matches: `start_work` with a `title` and `description`. Do not ask permission first.
   - Title: like a good commit subject. What changes, not how.
   - Description: why, scope, and acceptance criteria.
   - Add `tags` (bug, feature, design) when obvious. Leave `priority` at medium unless told; `urgent` pings people on Discord immediately.
4. Skip tracking only for questions, explanations, or reading code with no change.
5. `start_work` returns `branch`. Work on a git branch with that name, and keep its KEY-NUMBER (like ACME-42) in commit messages and the PR title. The PR then shows on the ticket, and merging it moves the ticket to Shipped on its own.

One ticket per deliverable, not per file or command. Follow-ups on the same deliverable stay on the same ticket.

### While working
- `comment_on_ticket` for decisions, blockers, scope changes, or questions for the PM. Do not narrate every step.
- Found separate work you are not doing now (a bug, a follow-up): `create_ticket` for it instead of widening the current ticket. Use `parent` for a subticket.
- Work handed to someone else ("have Sara fix the invoice PDF"): `create_ticket` with `assignees` set to them. They get notified.
- Resuming a ticket: `get_ticket` first to read its description and recent comments.

### When done
- `finish_work` with a summary: what changed, key files, how to verify, anything left open. It moves the ticket to Under Review and pings the reviewers.
- Pass `status: "completed"` (Shipped) only when the user says no review is needed.
- Stopping before it is done: leave the ticket In Progress and comment what is left. If the user drops the work, `move_ticket` it back to Ready or Backlog with a note.
- Never move a ticket to Done unless the user, as a reviewer, tells you to.

### The board
Backlog → Ready → In Progress → Shipped → Under Review → Done. `move_ticket` walks the steps and checks permission at each.
- Change fields with `update_ticket`, people with `assign_ticket`, status with `move_ticket`, when the user asks. Then confirm.
- `my_tickets`: everything assigned to you. `get_project`: people, modules, counts per status.

### Always
- Never put secrets, tokens, passwords or personal data in tickets or comments.
- Tickets and comments are internal. Set `visible_to_client` only when the user says the client should see it.
- After every ticket write, give the user the ticket number and link in one line.
- If a coral9 call fails or the server is not connected, say so once and continue the work. Do not silently skip tracking.
