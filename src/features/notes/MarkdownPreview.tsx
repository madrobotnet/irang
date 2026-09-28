"use client";

import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToast } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { NoteRef } from "@/lib/types";
import { expandWikiLinks, wikiTitleFromHref } from "./markdown";

export function MarkdownPreview({ body }: { body: string }) {
  const router = useRouter();
  const { toast } = useToast();
  return (
    <div className="prose-ko min-h-80 max-w-none overflow-x-auto rounded-card border border-line bg-card p-5 text-ink [&_a]:text-accent [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-line-strong [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-desk [&_code]:px-1 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-lg [&_img]:max-w-full [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-card [&_pre]:bg-desk [&_pre]:p-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:p-2 [&_th]:border [&_th]:border-line [&_th]:p-2 [&_ul]:list-disc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            const title = wikiTitleFromHref(href ?? "");
            if (title !== null) {
              return (
                <a
                  href={href}
                  {...props}
                  onClick={(event) => {
                    event.preventDefault();
                    void api<{ note: NoteRef }>("/api/notes/by-title", { method: "POST", json: { title } })
                      .then(({ note }) => router.push(`/notes/${note.id}`))
                      .catch((error: unknown) => toast(error instanceof Error ? error.message : "연결 노트를 열지 못했습니다.", { tone: "danger" }));
                  }}
                >
                  {children}
                </a>
              );
            }
            return <a href={href} rel="noreferrer noopener" target={href?.startsWith("http") ? "_blank" : undefined} {...props}>{children}</a>;
          },
        }}
      >
        {expandWikiLinks(body)}
      </ReactMarkdown>
    </div>
  );
}
