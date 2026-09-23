"use client";

import { useEffect, useReducer, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createNote, trashNote } from "@/lib/notes/client-api";
import { useToast } from "@/components/ui/Toast";
import { chatReducer, initialChatModel, messageCandidateIds } from "./chat-state";
import { ChatView } from "./ChatView";
import {
  createChatThread,
  decideNoteEdit,
  listChatMessages,
  listChatThreads,
  proposeNoteEdit,
  sendChatMessage,
} from "./client";
import { CHAT_COPY, promoteToastMessage } from "./copy";
import { notePath, readChatQuery, scopeHref, type ChatScope } from "./scope";

export function ChatScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const queryKey = params.toString();
  const [model, dispatch] = useReducer(chatReducer, queryKey, (key) =>
    initialChatModel(readChatQuery(new URLSearchParams(key))),
  );
  const modelRef = useRef(model);
  modelRef.current = model;
  const sendLock = useRef(false);
  const loadToken = useRef(0);

  useEffect(() => {
    dispatch({ type: "query", query: readChatQuery(new URLSearchParams(queryKey)) });
  }, [queryKey]);

  useEffect(() => {
    let cancel = false;
    void listChatThreads().then((result) => {
      if (cancel) return;
      if (result.ok) dispatch({ type: "threads", threads: result.value.threads });
      else dispatch({ type: "threads_quiet" });
    });
    return () => {
      cancel = true;
    };
  }, []);

  const send = async (question: string) => {
    const text = question.trim();
    const current = modelRef.current;
    if (!text || sendLock.current || current.surface === "streaming" || current.approvalPending) return;
    const candidateNoteIds = messageCandidateIds(current);
    sendLock.current = true;
    dispatch({ type: "begin", question: text });
    try {
      let threadId = current.activeThreadId;
      if (!threadId) {
        const created = await createChatThread(text.slice(0, 48));
        if (!created.ok) {
          dispatch({
            type: "fail",
            reason: created.reason,
            contextLimit: created.contextLimit,
          });
          return;
        }
        threadId = created.value.id;
        dispatch({ type: "thread_created", thread: created.value });
      }
      const result = await sendChatMessage(
        threadId,
        { body: text, candidateNoteIds },
        (delta) => dispatch({ type: "delta", delta }),
      );
      if (!result.ok) {
        dispatch({ type: "fail", reason: result.reason, contextLimit: result.contextLimit });
        return;
      }
      dispatch({ type: "turn", turn: result.value });
    } finally {
      sendLock.current = false;
    }
  };

  const selectThread = (threadId: string) => {
    const token = ++loadToken.current;
    dispatch({ type: "select_thread", threadId });
    void listChatMessages(threadId).then((result) => {
      if (token !== loadToken.current) return;
      if (!result.ok) {
        dispatch({ type: "fail", reason: result.reason, contextLimit: result.contextLimit });
        return;
      }
      dispatch({ type: "messages", threadId, messages: result.value.messages });
    });
  };

  const approve = async () => {
    const current = modelRef.current;
    const proposal = current.proposal;
    const threadId = current.activeThreadId ?? proposal?.threadId ?? null;
    if (!proposal || !threadId || current.approvalPending) return;
    dispatch({ type: "approval_pending" });
    let proposalId = proposal.proposalId;
    if (!proposalId) {
      const created = await proposeNoteEdit(threadId, {
        noteId: proposal.noteId,
        messageId: proposal.messageId,
        proposedTitle: proposal.proposedTitle,
        proposedBody: proposal.proposedBody,
      });
      if (!created.ok || !created.value.proposalId) {
        dispatch({ type: "approval_fail" });
        return;
      }
      proposalId = created.value.proposalId;
    }
    const decision = await decideNoteEdit(proposalId, "approve");
    if (!decision.ok) {
      dispatch({ type: "approval_fail" });
      return;
    }
    dispatch({ type: "approval_ok" });
  };

  const promote = async (messageId: string) => {
    const message = modelRef.current.messages.find((item) => item.id === messageId);
    if (!message || message.role !== "assistant") return;
    const stripped = message.body.replace(/\[\d+\]/g, " ").replace(/\s+/g, " ").trim();
    const title = stripped.split(" ").slice(0, 12).join(" ").slice(0, 80) || "새 노트";
    try {
      const note = await createNote({ title, body: message.body.trim() });
      showToast(promoteToastMessage(notePath(note.id)), {
        label: CHAT_COPY.undo,
        onClick: () => {
          void trashNote(note.id);
        },
      });
    } catch {
      showToast(CHAT_COPY.answerFail);
    }
  };

  const onScope = (scope: ChatScope) => {
    dispatch({ type: "scope", scope });
    router.replace(scopeHref(new URLSearchParams(queryKey), scope), { scroll: false });
  };

  return (
    <ChatView
      model={model}
      onScope={onScope}
      onDraft={(value) => dispatch({ type: "draft", value })}
      onSend={() => void send(modelRef.current.draft)}
      onRetry={() => {
        const question = modelRef.current.lastQuestion;
        if (question) void send(question);
      }}
      onSelectThread={selectThread}
      onNewThread={() => {
        loadToken.current += 1;
        dispatch({ type: "new_thread" });
      }}
      onCite={(messageId, index) => {
        dispatch({ type: "focus_citation", messageId, index });
        document.getElementById(`citation-${index}`)?.scrollIntoView({ block: "nearest" });
      }}
      onPromote={(messageId) => void promote(messageId)}
      onOpenProposal={() => dispatch({ type: "open_proposal" })}
      onSwipeCitations={() => {
        dispatch({ type: "toggle_citations" });
        document.querySelector("[data-citation-panel]")?.scrollIntoView({ block: "nearest" });
      }}
      onToggleTag={(tag) => dispatch({ type: "toggle_tag", tag })}
      onApprove={() => void approve()}
      onCancelApproval={() => {
        const proposalId = modelRef.current.proposal?.proposalId;
        dispatch({ type: "cancel_approval" });
        if (proposalId) void decideNoteEdit(proposalId, "reject");
      }}
    />
  );
}
