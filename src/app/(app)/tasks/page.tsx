import type { Metadata } from "next";
import { Suspense } from "react";
import { TasksLoading, TasksView } from "@/features/tasks";
import { TASKS_COPY } from "@/features/tasks/tasks-copy";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: TASKS_COPY[await getRequestLocale()].title };
}

export default function TasksPage() {
  return <Suspense fallback={<TasksLoading />}><TasksView /></Suspense>;
}
