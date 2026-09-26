import { randomUUID } from "node:crypto";
import type { LinkRecord } from "@/domain/graph/types";
import type { CreateLinkInput, CreateLinkResult, LinkStore } from "./ports";

function nowIso(): string {
  return new Date().toISOString();
}

export class MemoryLinkStore implements LinkStore {
  links = new Map<string, LinkRecord>();

  async createLink(input: CreateLinkInput): Promise<CreateLinkResult> {
    for (const link of this.links.values()) {
      if (
        link.fromNoteId === input.fromNoteId &&
        link.toNoteId === input.toNoteId &&
        link.relation === input.relation
      ) {
        return { link, created: false };
      }
    }
    const link: LinkRecord = {
      id: randomUUID(),
      fromNoteId: input.fromNoteId,
      toNoteId: input.toNoteId,
      relation: input.relation,
      createdAt: nowIso(),
    };
    this.links.set(link.id, link);
    return { link, created: true };
  }

  async deleteLink(id: string): Promise<boolean> {
    return this.links.delete(id);
  }

  async listLinks(): Promise<LinkRecord[]> {
    return [...this.links.values()].sort((left, right) => {
      const byTime = left.createdAt.localeCompare(right.createdAt);
      if (byTime !== 0) {
        return byTime;
      }
      return left.id.localeCompare(right.id);
    });
  }
}
