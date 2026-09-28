import { Suspense } from "react";
import { SearchPage } from "@/features/search/SearchPage";

export default function Page() {
  return <Suspense fallback={<div className="mx-auto w-full max-w-3xl px-4 py-8 text-sm text-mute">검색 화면을 불러오는 중입니다.</div>}><SearchPage /></Suspense>;
}
