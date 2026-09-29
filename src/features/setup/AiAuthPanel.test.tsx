import { expect, test } from "bun:test";
import { Children, isValidElement, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthCodeField } from "./AiAuthPanel";

type InputProps = { readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void };

function findInput(node: ReactNode): ReactElement<InputProps> | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (child.type === "input") return child as ReactElement<InputProps>;
    const nested = findInput(child.props.children);
    if (nested) return nested;
  }
  return null;
}

function codeField(onSubmitAction: () => void) {
  return AuthCodeField({
    id: "qa-google-code",
    value: "4/0Abc",
    error: null,
    submitting: false,
    onChangeAction: () => {},
    onSubmitAction,
  });
}

function pressEnter(input: ReactElement<InputProps>, isComposing: boolean) {
  let prevented = false;
  input.props.onKeyDown({
    key: "Enter",
    nativeEvent: { isComposing },
    preventDefault: () => { prevented = true; },
  } as unknown as KeyboardEvent<HTMLInputElement>);
  return prevented;
}

test("Enter in the Google code field submits the code instead of the surrounding form", () => {
  let submissions = 0;
  const input = findInput(codeField(() => { submissions += 1; }));
  if (!input) throw new Error("The code field must render an input");

  expect(pressEnter(input, true)).toBe(false);
  expect(submissions).toBe(0);
  expect(pressEnter(input, false)).toBe(true);
  expect(submissions).toBe(1);
});

test("the Google code field adds no nested form, submit button or form-data entry", () => {
  const markup = renderToStaticMarkup(codeField(() => {}));
  const buttons = markup.match(/<button\b[^>]*>/g) ?? [];

  expect(markup).not.toContain("<form");
  expect(buttons.length).toBeGreaterThan(0);
  for (const button of buttons) expect(button).toContain('type="button"');
  expect(markup).not.toMatch(/<input\b[^>]*\bname=/);
  expect(markup).toContain('for="qa-google-code"');
  expect(markup).toMatch(/<input\b[^>]*\bautoComplete="off"/);
});
