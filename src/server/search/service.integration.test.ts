import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { query } from "@/server/db";
import { closeDb, connectTestDatabase, resetData } from "@/server/test/db";
import { ApiError } from "@/server/http";
import { createNote } from "@/server/notes/service";
import { relatedNotes, searchNotes } from "./service";

connectTestDatabase();

async function insertNote({
  title,
  body,
  tags = [],
  status = "draft",
  deleted = false,
}: {
  title: string;
  body: string;
  tags?: string[];
  status?: string;
  deleted?: boolean;
}): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO notes (title, body, tags, status, deleted_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN now() ELSE NULL END)
     RETURNING id::text`,
    [title, body, tags, status, deleted],
  );
  return rows[0]!.id;
}

beforeEach(resetData);
afterAll(closeDb);

describe("searchNotes", () => {
  test("uses a freshly saved embedding without rebuilding it during a read", async () => {
    const note = await createNote({ title: "김치찌개", body: "김치찌개 재료와 조리 기록" });
    await query("UPDATE notes SET search_embedded_at='2000-01-01T00:00:00Z' WHERE id=$1", [note.id]);

    const result = await searchNotes("김치찌개");
    const rows = await query<{ indexed_at: Date }>(
      "SELECT search_embedded_at AS indexed_at FROM notes WHERE id=$1", [note.id],
    );

    expect(result.hits.find((hit) => hit.noteId === note.id)?.matchedBy).toContain("semantic");
    expect(rows[0]?.indexed_at.toISOString()).toBe("2000-01-01T00:00:00.000Z");
  });

  test("ranks a Korean exact term ahead of incidental notes and reports real signals", async () => {
    const exactId = await insertNote({
      title: "제주 여행 준비",
      body: "성산일출봉 일정을 아침에 시작한다.",
    });
    await insertNote({ title: "일상 기록", body: "아침 산책과 저녁 독서" });

    const result = await searchNotes("성산일출봉");

    expect(result.hits[0]?.noteId).toBe(exactId);
    expect(result.hits[0]?.matchedBy).toContain("keyword");
    expect(result.hits[0]?.matchedBy).toContain("fuzzy");
    expect(result.hits[0]?.snippet).toContain("성산일출봉");
    expect(result.hits[0]!.snippet.length).toBeLessThanOrEqual(220);
  });

  test("finds and ranks a Korean typo through fuzzy n-gram matching", async () => {
    const recipeId = await insertNote({ title: "김치찌개", body: "돼지고기와 묵은지로 끓이는 방법" });
    await insertNote({ title: "주간 회의", body: "프로젝트 진행 상황과 다음 할 일" });

    const result = await searchNotes("김치찌게");

    expect(result.hits[0]?.noteId).toBe(recipeId);
    expect(result.hits[0]?.matchedBy).toContain("fuzzy");
  });

  test("returns no result for an unrelated query", async () => {
    await insertNote({ title: "장보기", body: "우유 달걀 사과" });

    const result = await searchNotes("해왕성탐사선궤도계산");

    expect(result.hits).toEqual([]);
  });

  test("does not turn a hash collision without text overlap into a search result", async () => {
    await insertNote({
      title: "간격 반복의 원리",
      body: "기억이 흐려질 즈음 능동적으로 떠올리면 복습 효율이 높아진다. 단순 재독보다 질문을 만들고 [[회상 연습 설계]]로 답을 꺼내 본다. #학습 #기억",
    });

    expect((await searchNotes("PARA")).hits).toEqual([]);
  });

  test("applies a normalized tag filter", async () => {
    const workId = await insertNote({ title: "회고", body: "이번 주 배운 내용", tags: ["업무"] });
    await insertNote({ title: "개인 회고", body: "이번 주 배운 내용", tags: ["개인"] });

    const result = await searchNotes("배운 내용", { tag: "#업무" });

    expect(result.hits.map((hit) => hit.noteId)).toEqual([workId]);
  });

  test("excludes archived and deleted notes from every retrieval signal", async () => {
    const archivedId = await insertNote({ title: "비밀문구", body: "보관됨", status: "archived" });
    const deletedId = await insertNote({ title: "비밀문구", body: "삭제됨", deleted: true });

    const result = await searchNotes("비밀문구");

    expect(result.hits.map((hit) => hit.noteId)).not.toContain(archivedId);
    expect(result.hits.map((hit) => hit.noteId)).not.toContain(deletedId);
    expect(result.hits).toEqual([]);
  });

  test("handles empty and punctuation-only queries without SQL syntax errors", async () => {
    await insertNote({ title: "구두점", body: "평범한 메모" });

    await expect(searchNotes("   ")).resolves.toMatchObject({ hits: [] });
    await expect(searchNotes("!():* & |")).resolves.toMatchObject({ query: "!():* & |" });
  });

  test("refreshes a stale legacy embedding before using it", async () => {
    const id = await insertNote({ title: "변경 전", body: "오래된 본문" });
    await searchNotes("오래된 본문");
    await query("UPDATE notes SET body = $2 WHERE id::text = $1", [id, "새로운검색문구가 들어간 본문"]);

    const result = await searchNotes("새로운검색문구");
    const hashes = await query<{ fresh: boolean }>(
      `SELECT search_source_hash = md5(coalesce(title, '') || E'\\n' || coalesce(body, '')) AS fresh
         FROM notes WHERE id::text = $1`,
      [id],
    );

    expect(result.hits[0]?.noteId).toBe(id);
    expect(hashes[0]?.fresh).toBe(true);
  });

  test("rejects invalid tags and limits at the service boundary", async () => {
    await expect(searchNotes("검색", { tag: " # " })).rejects.toBeInstanceOf(ApiError);
    await expect(searchNotes("검색", { tag: " # " })).rejects.toMatchObject({ code: "validation" });
    await expect(searchNotes("검색", { limit: 101 })).rejects.toMatchObject({ code: "validation" });
  });
});

describe("relatedNotes", () => {
  test("ranks the closest active neighbour while excluding self, archived, and deleted notes", async () => {
    const sourceId = await insertNote({
      title: "PostgreSQL 검색 설계",
      body: "검색 인덱스와 벡터 유사도를 조합한다.",
    });
    const relatedId = await insertNote({
      title: "PostgreSQL 인덱스",
      body: "검색 인덱스와 벡터 거리 최적화 기록",
    });
    const archivedId = await insertNote({
      title: "PostgreSQL 검색 복사본",
      body: "검색 인덱스와 벡터 유사도를 조합한다.",
      status: "archived",
    });
    const deletedId = await insertNote({
      title: "PostgreSQL 삭제 복사본",
      body: "검색 인덱스와 벡터 유사도를 조합한다.",
      deleted: true,
    });
    await insertNote({ title: "요리 기록", body: "감자와 당근을 볶는다." });

    const result = await relatedNotes(sourceId, 10);
    const ids = result.map((note) => note.id);

    expect(result[0]?.id).toBe(relatedId);
    expect(ids).not.toContain(sourceId);
    expect(ids).not.toContain(archivedId);
    expect(ids).not.toContain(deletedId);
    expect(result[0]!.score).toBeGreaterThan(0.3);
  });
});
