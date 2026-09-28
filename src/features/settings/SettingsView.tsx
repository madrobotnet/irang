"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useShell } from "@/components/shell/ShellProvider";
import { modKey } from "@/components/shell/shortcuts";
import type { Theme } from "@/components/shell/ThemeProvider";
import { cn } from "@/components/ui/cn";
import { Shortcut } from "@/components/ui/Kbd";
import { AiConnections } from "./AiConnections";
import { Section } from "./SettingsSection";
import { SessionSection } from "./SettingsSession";

export function SettingsView() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-12 pt-5 sm:px-6 lg:px-10 lg:pt-10">
      <header className="border-b border-line pb-5">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">설정</h1>
        <p className="mt-1 text-sm text-mute">화면, 로그인 세션, 선택 기능이 어떻게 동작하는지 확인하고 바꿀 수 있어요.</p>
      </header>
      <div className="divide-y divide-line">
        <ThemeSection />
        <SessionSection />
        <AiConnections />
        <InstallSection />
        <DataSection />
        <ShortcutSection />
      </div>
    </div>
  );
}

const THEME_OPTIONS: readonly { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "시스템", icon: Monitor },
  { value: "light", label: "밝게", icon: Sun },
  { value: "dark", label: "어둡게", icon: Moon },
];

function ThemeSection() {
  const { theme, resolvedTheme, setTheme } = useShell();
  return (
    <Section id="settings-theme" title="화면" description="이 브라우저에 저장되며 새로고침하거나 다른 화면으로 가도 유지돼요.">
      <fieldset>
        <legend className="sr-only">테마</legend>
        <div className="grid grid-cols-3 gap-1 rounded-card border border-line bg-desk p-1">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                "flex min-h-touch cursor-pointer items-center justify-center gap-2 rounded-ctl text-base font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40",
                theme === value ? "bg-card text-ink shadow-card" : "text-mute hover:text-ink",
              )}
            >
              <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => setTheme(value)} className="sr-only" />
              <Icon aria-hidden className="size-4" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-2 text-sm text-mute" aria-live="polite">
        {theme === "system"
          ? `기기 설정을 따라 지금은 ${resolvedTheme === "dark" ? "어두운" : "밝은"} 화면이에요.`
          : `항상 ${theme === "dark" ? "어두운" : "밝은"} 화면으로 보여요.`}
      </p>
    </Section>
  );
}

function subscribeDisplayMode(onChange: () => void): () => void {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const readStandalone = () => window.matchMedia("(display-mode: standalone)").matches;

function InstallSection() {
  const standalone = useSyncExternalStore(subscribeDisplayMode, readStandalone, () => null);
  return (
    <Section id="settings-install" title="앱으로 설치" description="홈 화면이나 작업 표시줄에서 바로 열 수 있게 설치할 수 있어요.">
      <p className="text-md">
        {standalone === null ? "\u00a0" : standalone ? "지금 설치된 앱으로 실행 중이에요." : "지금은 브라우저에서 열려 있어요."}
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-mute">
        <li>Chrome이나 Edge에서는 주소창의 설치 아이콘이나 메뉴의 &lsquo;앱 설치&rsquo;를 누르세요.</li>
        <li>iPhone과 iPad의 Safari에서는 공유 버튼을 누른 뒤 &lsquo;홈 화면에 추가&rsquo;를 고르세요.</li>
        <li>Android에 설치하면 다른 앱의 공유 메뉴에서 세컨드 브레인을 골라 링크나 글을 인박스로 보낼 수 있어요.</li>
        <li>설치해도 오프라인 저장소는 없어요. 인터넷에 연결되어 있어야 노트를 열고 저장할 수 있어요.</li>
      </ul>
    </Section>
  );
}

function DataSection() {
  return (
    <Section id="settings-data" title="데이터 보관" description="노트가 어디에 저장되는지 알려 드려요.">
      <p className="text-sm text-mute">
        노트, 인박스, 채팅 기록과 첨부 파일은 이 앱을 운영하는 서버의 데이터베이스와 저장 폴더에 저장돼요. 브라우저에 따로 암호화해 보관하지 않으며, 이 기기에는 로그인 쿠키와
        테마, 사이드바 설정만 남아요. 백업과 내보내기는 서버에서 관리해요.
      </p>
    </Section>
  );
}

const readMod = () => modKey();

function ShortcutSection() {
  const mod = useSyncExternalStore(subscribeNever, readMod, () => "Ctrl");
  const rows: readonly (readonly [readonly string[], string])[] = [
    [[mod, "K"], "명령 팔레트"],
    [[mod, "P"], "노트 빠르게 열기"],
    [["c"], "빠르게 캡처"],
    [["/"], "검색으로 이동"],
    [["g", "h"], "홈으로 이동"],
    [["g", "i"], "인박스로 이동"],
    [["g", "n"], "노트로 이동"],
    [["g", "s"], "검색으로 이동"],
    [["g", "g"], "그래프로 이동"],
    [["g", "c"], "채팅으로 이동"],
  ];
  return (
    <Section
      id="settings-keys"
      title="키보드 단축키"
      description="글을 입력하는 중에는 한 글자 단축키가 동작하지 않아요."
      className="max-lg:hidden"
    >
      <dl className="grid grid-cols-2 gap-x-8">
        {rows.map(([keys, label]) => (
          <div key={keys.join("+")} className="flex items-center justify-between gap-3 border-b border-line py-2">
            <dt className="text-base">{label}</dt>
            <dd>
              <span className="sr-only">{keys.join(" ")}</span>
              <Shortcut keys={keys} />
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function subscribeNever(): () => void {
  return () => undefined;
}
