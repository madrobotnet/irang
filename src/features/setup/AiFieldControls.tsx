"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/Input";

export function FieldError({ id, message }: { readonly id: string; readonly message?: string }) {
  return message ? <p id={id} role="alert" className="text-sm text-danger">{message}</p> : null;
}

export function SecretInput({ id, label, hint, error, value, disabled, onChangeAction }: {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly value: string;
  readonly disabled?: boolean;
  readonly onChangeAction: (next: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      id={id}
      label={label}
      hint={error ? undefined : hint}
      error={error}
      type={visible ? "text" : "password"}
      autoComplete="off"
      spellCheck={false}
      value={value}
      disabled={disabled}
      className="h-11 pr-14"
      onChange={(event) => onChangeAction(event.target.value)}
      trailing={
        <button
          type="button"
          aria-label={visible ? "키 숨기기" : "키 보기"}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
          className="flex size-11 items-center justify-center rounded-ctl text-mute hover:bg-line/60 hover:text-ink focus-ring"
        >
          {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      }
    />
  );
}

export function ConsentRow({ id, checked, disabled, onChangeAction, error, children }: {
  readonly id: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChangeAction: (next: boolean) => void;
  readonly error?: string;
  readonly children: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex min-h-touch cursor-pointer items-start gap-2.5 text-sm text-ink">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChangeAction(event.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-4 shrink-0 accent-accent"
        />
        <span>{children}</span>
      </label>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
