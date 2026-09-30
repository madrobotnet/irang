import { defineCopy } from "@/lib/i18n/copy";

/** Tasks page copy. The rail label lives in SHELL_COPY.nav.tasks. */
export const TASKS_COPY = defineCopy({
  ko: {
    title: "할 일",
    lead: "노트에 적은 체크박스(- [ ])를 노트별로 모아 보여 줘요. 여기서 체크하면 원래 노트에도 바로 반영돼요.",
    filterLabel: "할 일 필터",
    filters: { open: "남은 일", done: "완료", all: "전체" },
    summary: (tasks: number, notes: number) => `노트 ${notes}개 · 할 일 ${tasks}개`,
    listLabel: "노트별 할 일",
    daily: "데일리 노트",
    groupCount: (open: number, total: number) => `${total}개 중 ${open}개 남음`,
    truncated: "할 일이 많아 일부만 보여요. 최근에 수정한 노트 500개에서 할 일을 2,000개까지만 모았어요.",
    loading: "할 일을 불러오는 중",
    loadFailed: "할 일을 불러오지 못했어요.",
    loadHint: "네트워크 연결을 확인한 뒤 다시 시도하세요.",
    retry: "다시 시도",
    empty: {
      open: "남은 할 일이 없어요",
      done: "완료한 할 일이 없어요",
      all: "아직 할 일이 없어요",
    },
    emptyHint: {
      open: "노트에 '- [ ] 할 일'처럼 적으면 여기에 모여요.",
      done: "할 일을 체크하면 여기에 보여요.",
      all: "노트에 '- [ ] 할 일'처럼 적으면 여기에 모여요.",
    },
    toggleFailed: "할 일을 바꾸지 못했어요. 다시 시도하세요.",
  },
  en: {
    title: "Tasks",
    lead: "Checkboxes (- [ ]) from your notes, grouped by note. Checking one here updates its note right away.",
    filterLabel: "Task filter",
    filters: { open: "Open", done: "Done", all: "All" },
    summary: (tasks, notes) => `${tasks === 1 ? "1 task" : `${tasks} tasks`} in ${notes === 1 ? "1 note" : `${notes} notes`}`,
    listLabel: "Tasks by note",
    daily: "Daily note",
    groupCount: (open, total) => `${open} of ${total} open`,
    truncated: "There are too many tasks to show them all: up to 2,000 from the 500 most recently edited notes.",
    loading: "Loading tasks",
    loadFailed: "Couldn't load tasks.",
    loadHint: "Check your network connection, then try again.",
    retry: "Try again",
    empty: {
      open: "No open tasks",
      done: "No finished tasks",
      all: "No tasks yet",
    },
    emptyHint: {
      open: "Write '- [ ] something' in a note and it shows up here.",
      done: "Tasks you check off show up here.",
      all: "Write '- [ ] something' in a note and it shows up here.",
    },
    toggleFailed: "Couldn't update the task. Try again.",
  },
});
