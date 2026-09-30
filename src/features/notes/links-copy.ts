import { defineCopy } from "@/lib/i18n/copy";

/**
 * Link upgrades in the notes workspace: linking unlinked mentions and `[[` completion.
 * Note titles are user data and arrive as arguments, never as catalog text.
 */
export const LINKS_COPY = defineCopy({
  ko: {
    mentions: {
      link: "링크하기",
      linkLabel: (title: string) => `'${title}'의 언급 링크하기`,
      linked: (title: string) => `'${title}'의 언급을 링크했어요.`,
      gone: (title: string) => `'${title}'에 링크할 언급이 남아 있지 않아요.`,
      stale: (title: string) => `'${title}' 노트가 방금 바뀌어서 링크하지 못했어요. 다시 시도하세요.`,
      failed: "언급을 링크하지 못했어요.",
    },
    completion: {
      create: (title: string) => `'${title}' 새 노트 만들기`,
      createFailed: (title: string) => `'${title}' 노트를 만들지 못했어요. 링크는 본문에 그대로 있어요.`,
    },
  },
  en: {
    mentions: {
      link: "Link",
      linkLabel: (title) => `Link the mention in "${title}"`,
      linked: (title) => `Linked the mention in "${title}".`,
      gone: (title) => `"${title}" has no mention left to link.`,
      stale: (title) => `"${title}" just changed, so the mention wasn't linked. Try again.`,
      failed: "Couldn't link the mention.",
    },
    completion: {
      create: (title) => `Create note "${title}"`,
      createFailed: (title) => `Couldn't create "${title}". The link stays in the note.`,
    },
  },
});
