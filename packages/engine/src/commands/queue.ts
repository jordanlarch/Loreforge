/**
 * Per-campaign command queue.
 *
 * Commands for a single campaign are serialized so each validates against the
 * state left by the previous one — no interleaving, no lost updates
 * (`docs/engine/architecture.md` §10.2). Submissions resolve in FIFO order even
 * when the executor is async (e.g. a Postgres-backed store).
 */
import type { Command, CommandResult } from "./types";

export type CommandExecutor = (command: Command) => Promise<CommandResult> | CommandResult;

type QueueItem = {
  command: Command;
  resolve: (result: CommandResult) => void;
  reject: (error: unknown) => void;
};

export class CampaignCommandQueue {
  private readonly queue: QueueItem[] = [];
  private draining = false;

  constructor(private readonly executor: CommandExecutor) {}

  enqueue(command: Command): Promise<CommandResult> {
    return new Promise<CommandResult>((resolve, reject) => {
      this.queue.push({ command, resolve, reject });
      void this.drain();
    });
  }

  get pending(): number {
    return this.queue.length;
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift()!;
        try {
          item.resolve(await this.executor(item.command));
        } catch (error) {
          item.reject(error);
        }
      }
    } finally {
      this.draining = false;
    }
  }
}
