"use client";

import { JEV_PROVIDERS, JevProviderSchema } from "@/lib/ai-settings";
import { inputClassName } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import { ConsentRow, FieldError, SecretInput } from "./AiFieldControls";
import { jevProviderInfo, type AiFormErrors, type JevFormState, type SavedAiView } from "./ai-form";

export function JevAiFields({ value: jev, onChange, disabled, saved, errors, idPrefix }: {
  readonly value: JevFormState;
  readonly onChange: (next: JevFormState) => void;
  readonly disabled: boolean;
  readonly saved: SavedAiView;
  readonly errors: AiFormErrors;
  readonly idPrefix: string;
}) {
  const info = jevProviderInfo(jev.provider);
  const retained = saved?.jev?.provider === jev.provider && saved.jev.hasApiKey;
  const setJev = (patch: Partial<JevFormState>) => onChange({ ...jev, ...patch });
  return (
    <fieldset className="rounded-card border border-line p-4 sm:p-5" disabled={disabled}>
      <legend className="px-1 text-md font-semibold">인박스 정리 AI (Jev)</legend>
      <p className="text-sm leading-relaxed text-mute">
        캡처할 때 분류, 태그, 중복 후보를 제안해요. 캡처 제목, 본문 앞 4,000자, 최근 노트의 제목·ID가 선택한 제공자에게 전송돼요.
        채팅 모델과는 별개이며, 꺼져 있거나 실패해도 캡처는 그대로 저장돼요.
      </p>
      {saved?.jevManagedByEnvironment ? (
        <p className="mt-2 rounded-ctl bg-warn-soft px-3 py-2 text-sm text-warn">
          지금은 서버 환경의 기존 Jev 연결을 사용 중이에요. 여기서 저장하면 새 설정이 적용되고, 끄고 저장하면 Jev가 꺼져요.
        </p>
      ) : null}
      <label htmlFor={`${idPrefix}-jev-enabled`} className="mt-3 flex min-h-touch cursor-pointer items-center gap-2.5 text-md font-medium">
        <input id={`${idPrefix}-jev-enabled`} type="checkbox" checked={jev.enabled}
          onChange={(event) => setJev({ enabled: event.target.checked })} className="size-4 shrink-0 accent-accent" />
        인박스 정리에 Jev 사용
      </label>
      {jev.enabled ? (
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${idPrefix}-jev-provider`} className="text-sm font-medium">Jev 제공자</label>
              <select id={`${idPrefix}-jev-provider`} value={jev.provider}
                onChange={(event) => {
                  const provider = JevProviderSchema.parse(event.target.value);
                  setJev({ provider, model: jevProviderInfo(provider).model, apiKey: "", consent: false });
                }} className={cn(inputClassName, "pr-8")}>
                {JEV_PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
              </select>
              <p className="text-sm text-mute">제공자마다 키와 사용량이 별도로 관리돼요.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${idPrefix}-jev-model`} className="text-sm font-medium">사용할 Jev 모델</label>
              <input id={`${idPrefix}-jev-model`} list={`${idPrefix}-jev-models`} value={jev.model}
                onChange={(event) => setJev({ model: event.target.value })}
                aria-invalid={errors["jev.model"] ? true : undefined}
                aria-describedby={errors["jev.model"] ? `${idPrefix}-jev-model-error` : `${idPrefix}-jev-model-hint`}
                autoComplete="off" spellCheck={false} className={inputClassName} />
              <datalist id={`${idPrefix}-jev-models`}>
                <option value={info.model} />
                <option value={jev.provider === "typesafe" ? "jev-1.13.0" : "typesafe/jev-1.13"} />
              </datalist>
              <FieldError id={`${idPrefix}-jev-model-error`} message={errors["jev.model"]} />
              <p id={`${idPrefix}-jev-model-hint`} className="text-sm text-mute">
                구조화된 판단을 반환하는 Jev 모델을 선택하세요. OpenRouter의 Jev Router는 다른 제품이에요.
              </p>
            </div>
          </div>
          <SecretInput id={`${idPrefix}-jev-key`} label="Jev API 키" value={jev.apiKey} disabled={disabled}
            onChange={(apiKey) => setJev({ apiKey })} error={errors["jev.apiKey"]}
            hint={retained ? "저장된 키가 있어요. 바꾸지 않으려면 비워 두세요." : "선택한 Jev 제공자에서 발급한 키를 입력하세요. 저장 뒤에는 다시 표시되지 않아요."} />
          <ConsentRow id={`${idPrefix}-jev-consent`} checked={jev.consent} disabled={disabled}
            onChange={(consent) => setJev({ consent })} error={errors["jev.consent"]}>
            캡처 내용과 최근 노트 정보를 선택한 Jev 제공자에게 보내는 데 동의합니다.
          </ConsentRow>
        </div>
      ) : null}
    </fieldset>
  );
}
