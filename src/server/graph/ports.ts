import type { GraphRelation, LinkRecord } from "@/domain/graph/types";

export type CreateLinkInput = {
  fromNoteId: string;
  toNoteId: string;
  relation: GraphRelation;
};

export type CreateLinkResult = {
  link: LinkRecord;
  created: boolean;
};

export type LinkStore = {
  createLink(input: CreateLinkInput): Promise<CreateLinkResult>;
  deleteLink(id: string): Promise<boolean>;
  listLinks(): Promise<LinkRecord[]>;
};
