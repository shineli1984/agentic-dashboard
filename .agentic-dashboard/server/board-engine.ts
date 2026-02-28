import { execSync } from "node:child_process";
import type {
  AttentionItem,
  AttentionUrgency,
  BoardCard,
  BoardStage,
  DashboardState,
  Session,
} from "./types.js";

interface SessionEpoch {
  sessionId: string;
  epoch: number;
  cardId: string;
  stageEnteredAt: number;
  lastKnownStage: BoardStage;
  title: string;
  completedAt?: number;
  messageCountAtCompletion?: number;
  taskCountAtCompletion?: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-|^[a-z]+-[a-z0-9]{6,}$/i;

const URGENCY_ORDER: Record<AttentionUrgency, number> = {
  blocking: 0,
  waiting: 1,
  informational: 2,
};

export class BoardEngine {
  private epochs = new Map<string, SessionEpoch[]>();
  private dismissed = new Set<string>();
  private titleCache = new Map<string, string>();

  evaluate(state: DashboardState): BoardCard[] {
    const cards: BoardCard[] = [];
    const seenSessionIds = new Set<string>();

    for (const workspace of state.workspaces) {
      for (const session of workspace.sessions) {
        seenSessionIds.add(session.id);
        const sessionEpochs = this.resolveEpochs(session);

        for (const epoch of sessionEpochs) {
          if (this.dismissed.has(epoch.cardId)) continue;

          const stage = epoch.completedAt && epoch !== sessionEpochs[sessionEpochs.length - 1]
            ? "done" as BoardStage
            : this.deriveStage(session);

          // Update epoch tracking
          if (epoch === sessionEpochs[sessionEpochs.length - 1]) {
            if (stage !== epoch.lastKnownStage) {
              epoch.stageEnteredAt = Date.now();
              epoch.lastKnownStage = stage;
              if (stage === "done") {
                epoch.completedAt = Date.now();
                epoch.messageCountAtCompletion = session.messages.length;
                epoch.taskCountAtCompletion = session.tasks.length;
              }
            }
          }

          const title = this.deriveTitle(session, epoch);
          epoch.title = title;

          const attention = this.deriveAttention(session, state.attentionItems);
          const taskSummary = this.buildTaskSummary(session);

          cards.push({
            id: epoch.cardId,
            title,
            stage: epoch === sessionEpochs[sessionEpochs.length - 1] ? stage : "done",
            sessionId: session.id,
            taskSummary,
            attention,
            stageEnteredAt: epoch.stageEnteredAt,
            lastActivity: session.lastActivity,
          });
        }
      }
    }

    return cards;
  }

  dismiss(cardId: string): boolean {
    // Find the card in current epochs to validate it's done
    for (const epochList of this.epochs.values()) {
      for (const epoch of epochList) {
        if (epoch.cardId === cardId) {
          if (epoch.lastKnownStage === "done" || epoch.completedAt) {
            this.dismissed.add(cardId);
            return true;
          }
          return false;
        }
      }
    }
    return false;
  }

  private resolveEpochs(session: Session): SessionEpoch[] {
    let epochList = this.epochs.get(session.id);

    if (!epochList) {
      const epoch: SessionEpoch = {
        sessionId: session.id,
        epoch: 0,
        cardId: `${session.id}-epoch-0`,
        stageEnteredAt: Date.now(),
        lastKnownStage: this.deriveStage(session),
        title: "",
      };
      epochList = [epoch];
      this.epochs.set(session.id, epochList);
      return epochList;
    }

    const currentEpoch = epochList[epochList.length - 1];

    // Check for epoch reset: was done, now has new work
    if (currentEpoch.completedAt) {
      const hasNewTasks = session.tasks.length > (currentEpoch.taskCountAtCompletion ?? 0)
        && session.tasks.some((t) => t.status === "pending" || t.status === "in_progress");
      const hasNewMessages = session.messages.length > (currentEpoch.messageCountAtCompletion ?? 0);

      if (hasNewTasks || hasNewMessages) {
        const newEpochNum = currentEpoch.epoch + 1;
        const newEpoch: SessionEpoch = {
          sessionId: session.id,
          epoch: newEpochNum,
          cardId: `${session.id}-epoch-${newEpochNum}`,
          stageEnteredAt: Date.now(),
          lastKnownStage: this.deriveStage(session),
          title: "",
        };
        epochList.push(newEpoch);
      }
    }

    return epochList;
  }

  private deriveStage(session: Session): BoardStage {
    const tasks = session.tasks;
    const messages = session.messages;

    if (tasks.length === 0 && messages.length === 0) return "backlog";
    if (tasks.length === 0 && messages.length > 0) return "in_progress";
    if (session.isActive) return "in_progress";

    const allCompleted = tasks.length > 0 && tasks.every((t) => t.status === "completed");
    if (allCompleted) return "done";

    const anyInProgress = tasks.some((t) => t.status === "in_progress");
    if (anyInProgress) return "in_progress";

    const allPending = tasks.every((t) => t.status === "pending");
    if (allPending) return "backlog";

    // Mixed states (some completed, some pending, none in_progress) → in_progress
    return "in_progress";
  }

  private deriveTitle(session: Session, epoch: SessionEpoch): string {
    // Return cached title if already derived for this epoch
    if (epoch.title) return epoch.title;

    // 1. metadata.description
    if (typeof session.metadata?.description === "string" && session.metadata.description) {
      return session.metadata.description;
    }

    // 2. Meaningful session name (not UUID-like)
    if (session.name && !UUID_PATTERN.test(session.name)) {
      return session.name;
    }

    // 3. First task subject
    if (session.tasks.length > 0) {
      return session.tasks[0].subject;
    }

    // 4. First message summary
    if (session.messages.length > 0) {
      const msg = session.messages[0];
      const text = msg.summary ?? msg.content;
      return text.length > 50 ? text.slice(0, 47) + "..." : text;
    }

    // 5. CLI fallback
    return this.deriveTitleWithCLI(session, epoch);
  }

  private deriveTitleWithCLI(session: Session, epoch: SessionEpoch): string {
    if (this.titleCache.has(epoch.cardId)) return this.titleCache.get(epoch.cardId)!;

    const msgs = session.messages.slice(0, 3).map((m) => m.summary ?? m.content.slice(0, 100));
    if (msgs.length === 0) return session.name;

    try {
      const prompt = `Summarize this work session in 5 words or fewer: ${msgs.join(" | ")}`;
      const result = execSync(`claude --print -p "${prompt.replace(/"/g, '\\"')}"`, {
        timeout: 10_000,
        encoding: "utf-8",
      }).trim();
      if (result) {
        this.titleCache.set(epoch.cardId, result);
        return result;
      }
    } catch {
      // CLI not available or timed out — fall through
    }
    return session.name;
  }

  private deriveAttention(
    session: Session,
    attentionItems: AttentionItem[],
  ): BoardCard["attention"] | undefined {
    // Check attention items referencing this session
    const sessionAttention = attentionItems.filter(
      (item) => item.source.session === session.id,
    );

    // Check needsResponse messages
    const needsResponseMsgs = session.messages.filter((m) => m.needsResponse);

    if (sessionAttention.length === 0 && needsResponseMsgs.length === 0) return undefined;

    // Pick most urgent attention item
    let urgency: AttentionUrgency = "informational";
    let preview = "";

    if (sessionAttention.length > 0) {
      sessionAttention.sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]);
      urgency = sessionAttention[0].urgency;
      if (sessionAttention.length === 1) {
        preview = sessionAttention[0].shortContext;
      } else {
        preview = `${sessionAttention.length} items need attention`;
      }
    } else if (needsResponseMsgs.length > 0) {
      urgency = "waiting";
      if (needsResponseMsgs.length === 1) {
        const msg = needsResponseMsgs[0];
        preview = msg.summary ?? `${msg.from}: needs response`;
      } else {
        preview = `${needsResponseMsgs.length} messages need response`;
      }
    }

    return { urgency, preview };
  }

  private buildTaskSummary(session: Session): string {
    if (session.tasks.length === 0) return "no tasks";
    const completed = session.tasks.filter((t) => t.status === "completed").length;
    return `${completed}/${session.tasks.length} tasks done`;
  }
}
