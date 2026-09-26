import type { Pool } from "pg";
import { isGraphRelation, type LinkRecord } from "@/domain/graph/types";
import type { CreateLinkInput, CreateLinkResult, LinkStore } from "./ports";

type LinkRow = {
  id: string;
  from_note_id: string;
  to_note_id: string;
  relation: string;
  created_at: Date;
};

function mapLinkRow(row: LinkRow): LinkRecord | null {
  if (!isGraphRelation(row.relation)) {
    return null;
  }
  return {
    id: row.id,
    fromNoteId: row.from_note_id,
    toNoteId: row.to_note_id,
    relation: row.relation,
    createdAt: row.created_at.toISOString(),
  };
}

export class PostgresLinkStore implements LinkStore {
  constructor(private readonly pool: Pool) {}

  async createLink(input: CreateLinkInput): Promise<CreateLinkResult> {
    const inserted = await this.pool.query<LinkRow>(
      `INSERT INTO links (from_note_id, to_note_id, relation)
       VALUES ($1::uuid, $2::uuid, $3)
       ON CONFLICT (from_note_id, to_note_id, relation) DO NOTHING
       RETURNING id, from_note_id, to_note_id, relation, created_at`,
      [input.fromNoteId, input.toNoteId, input.relation],
    );
    const createdRow = inserted.rows[0];
    if (createdRow) {
      const link = mapLinkRow(createdRow);
      if (!link) {
        throw new Error("inserted link relation failed the graph relation check");
      }
      return { link, created: true };
    }
    const existing = await this.pool.query<LinkRow>(
      `SELECT id, from_note_id, to_note_id, relation, created_at
       FROM links
       WHERE from_note_id = $1::uuid AND to_note_id = $2::uuid AND relation = $3`,
      [input.fromNoteId, input.toNoteId, input.relation],
    );
    const row = existing.rows[0];
    const link = row ? mapLinkRow(row) : null;
    if (!link) {
      throw new Error("link conflict did not return the existing row");
    }
    return { link, created: false };
  }

  async deleteLink(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`DELETE FROM links WHERE id = $1::uuid`, [id]);
    return (rowCount ?? 0) > 0;
  }

  async listLinks(): Promise<LinkRecord[]> {
    const { rows } = await this.pool.query<LinkRow>(
      `SELECT id, from_note_id, to_note_id, relation, created_at
       FROM links
       ORDER BY created_at ASC, id ASC`,
    );
    const links: LinkRecord[] = [];
    for (const row of rows) {
      const link = mapLinkRow(row);
      if (link) {
        links.push(link);
      }
    }
    return links;
  }
}
