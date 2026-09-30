import { expect, test } from "bun:test";
import { hangulIn, html, renderInLocale } from "@/features/setup/test-locale";
import { LoginForm } from "./LoginForm";
import { LOGIN_COPY } from "./login-copy";

test("the login form renders only the current locale's copy", () => {
  const english = renderInLocale(<LoginForm next="/" />, "en");
  expect(hangulIn(english)).toEqual([]);
  expect(english).toContain(html(LOGIN_COPY.en.submit));
  const korean = renderInLocale(<LoginForm next="/" />, "ko");
  expect(korean).toContain(html(LOGIN_COPY.ko.submit));
  expect(korean).toContain(`aria-label="${html(LOGIN_COPY.ko.showPassword)}"`);
});
