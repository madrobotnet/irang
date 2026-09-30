import { isIP } from "node:net";
import { closeDb, query, tx } from "@/server/db";
import { captureInbox } from "@/server/inbox";
import { createNote, updateNote } from "@/server/notes/service";

type DemoNote = {
  title: string;
  body: string;
  tags: string[];
  pinned?: boolean;
};

const DEMO_TAG = "demo-vault";

const NOTES: readonly DemoNote[] = [
  {
    title: "배움은 연결에서 자란다",
    body: "새 지식은 고립된 사실보다 기존 생각과 연결될 때 오래 남는다. [[제텔카스텐의 핵심]]은 이 연결을 작은 습관으로 만든다. #학습 #연결",
    tags: ["학습", "연결"],
    pinned: true,
  },
  {
    title: "제텔카스텐의 핵심",
    body: "한 노트에는 한 생각을 담고, 출처보다 내 언어로 설명한다. 다음 행동은 [[영구 노트 작성법]]에 따라 연결 질문을 하나 남기는 것이다. #제텔카스텐",
    tags: ["제텔카스텐", "노트법"],
    pinned: true,
  },
  {
    title: "영구 노트 작성법",
    body: "맥락 없이도 이해되는 문장으로 쓰고 관련 이유를 적는다. [[배움은 연결에서 자란다]]와 비교하면 링크가 단순 분류가 아니라 논증의 일부임을 알 수 있다. #글쓰기 #노트법",
    tags: ["글쓰기", "노트법"],
  },
  {
    title: "PARA로 실행 가능성 높이기",
    body: "Project는 끝이 있는 결과, Area는 계속 관리할 책임이다. Resource와 Archive는 지원 역할을 한다. 지식을 행동으로 옮길 때 [[프로젝트 사고법]]과 함께 쓴다. #para #생산성",
    tags: ["para", "생산성"],
  },
  {
    title: "프로젝트 사고법",
    body: "모호한 관심사를 완료 조건이 보이는 결과로 바꾼다. 다음 행동을 작게 정하고 [[주간 리뷰 질문]]에서 장애물을 점검한다. #프로젝트 #실행",
    tags: ["프로젝트", "실행"],
    pinned: true,
  },
  {
    title: "간격 반복의 원리",
    body: "기억이 흐려질 즈음 능동적으로 떠올리면 복습 효율이 높아진다. 단순 재독보다 질문을 만들고 [[회상 연습 설계]]로 답을 꺼내 본다. #학습 #기억",
    tags: ["학습", "기억"],
  },
  {
    title: "회상 연습 설계",
    body: "정답을 보기 전에 설명하고, 틀린 이유를 기록한다. 복습 간격은 [[간격 반복의 원리]]를 따르되 어려운 항목에 더 자주 돌아온다. #복습 #학습",
    tags: ["복습", "학습"],
  },
  {
    title: "주간 리뷰 질문",
    body: "무엇을 끝냈는가? 무엇이 막혔는가? 다음 주 가장 작은 진전은 무엇인가? [[PARA로 실행 가능성 높이기]]의 Project와 Area를 함께 살핀다. #리뷰 #계획",
    tags: ["리뷰", "계획"],
  },
  {
    title: "독서 노트는 대화다",
    body: "요약만 하지 말고 저자의 주장에 동의하거나 반박한다. 떠오른 연결을 [[질문이 좋은 노트를 만든다]]에 적고 내 프로젝트에서 시험한다. #독서 #책",
    tags: ["독서", "책"],
  },
  {
    title: "질문이 좋은 노트를 만든다",
    body: "답을 저장하는 노트보다 다음 탐색을 여는 질문이 유용하다. 질문은 [[독서 노트는 대화다]]와 [[영구 노트 작성법]] 사이를 잇는다. #질문 #사고",
    tags: ["질문", "사고"],
  },
  {
    title: "아토믹 해빗에서 배운 점",
    body: "목표보다 반복 가능한 시스템을 설계한다. 환경의 마찰을 줄이고 작은 성공을 보이게 만들어 [[프로젝트 사고법]]의 다음 행동을 지속한다. #책 #습관",
    tags: ["책", "습관"],
  },
  {
    title: "지식 정원의 가지치기",
    body: "노트 수를 늘리는 것만큼 오래된 생각을 다시 읽고 합치거나 고치는 일이 중요하다. [[주간 리뷰 질문]]과 [[배움은 연결에서 자란다]]를 기준으로 정원을 돌본다. #리뷰 #연결",
    tags: ["리뷰", "연결"],
  },
];

const INBOX = [
  { title: "예시 · 다음 독서 후보", text: "《생각에 관한 생각》을 읽고 판단 편향을 프로젝트 회고와 연결해 보기" },
  { title: "예시 · 실험할 학습 습관", text: "매일 저녁 오늘 배운 내용을 보지 않고 세 문장으로 회상하기" },
  { title: "예시 · 프로젝트 질문", text: "진행 중인 프로젝트의 완료 조건을 한 문장으로 다시 써 보기" },
] as const;

function assertSafeTarget(rawUrl: string, allowNonlocal: boolean): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("DATABASE_URL이 올바른 URL이 아닙니다.");
  }
  const host = url.hostname.toLowerCase();
  const local = host === "localhost" || host === "[::1]" ||
    (isIP(host) === 4 && host.startsWith("127."));
  if ((!local || process.env.NODE_ENV === "production") && !allowNonlocal) {
    throw new Error("로컬 개발 데이터베이스가 아닙니다. 의도했다면 --allow-nonlocal을 지정하세요.");
  }
}

export async function seedDemoVault(options: { allowNonlocal?: boolean } = {}): Promise<{ notes: number; inbox: number }> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL이 설정되지 않았습니다.");
  assertSafeTarget(databaseUrl, options.allowNonlocal ?? false);

  const ids = await tx(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('seed:demo-vault:v2',0))");
    const existing = await client.query<{ id: string; title: string; tags: string[] }>(
      "SELECT id::text,title,tags FROM notes WHERE deleted_at IS NULL AND title=ANY($1::text[])",
      [NOTES.map((note) => note.title)],
    );
    const byTitle = new Map(existing.rows.map((row) => [row.title, row]));
    const collision = existing.rows.find((row) => !row.tags.includes(DEMO_TAG));
    if (collision) {
      throw new Error(`기존 노트와 제목이 겹칩니다: ${collision.title}`);
    }

    for (const note of NOTES) {
      if (byTitle.has(note.title)) continue;
      const created = await createNote({ title: note.title, tags: [DEMO_TAG] }, client);
      byTitle.set(note.title, { id: created.id, title: created.title, tags: created.tags });
    }
    return new Map([...byTitle].map(([title, row]) => [title, row.id]));
  });

  for (const note of NOTES) {
    const id = ids.get(note.title);
    if (!id) throw new Error(`예시 노트 ID를 찾지 못했습니다: ${note.title}`);
    await updateNote(id, {
      body: note.body,
      tags: [...note.tags, DEMO_TAG],
      pinned: note.pinned ?? false,
      archived: false,
    });
  }

  const existingInbox = await query<{ title: string }>(
    "SELECT title FROM inbox_items WHERE title=ANY($1::text[])",
    [INBOX.map((item) => item.title)],
  );
  const existingTitles = new Set(existingInbox.map((item) => item.title));
  for (const item of INBOX) {
    if (!existingTitles.has(item.title)) await captureInbox({ ...item, source: "api" });
  }

  return { notes: NOTES.length, inbox: INBOX.length };
}

if (import.meta.main) {
  try {
    const result = await seedDemoVault({ allowNonlocal: process.argv.includes("--allow-nonlocal") });
    console.log(`예시 보관함 준비 완료: 노트 ${result.notes}개, 인박스 ${result.inbox}개`);
  } finally {
    await closeDb();
  }
}
