import type { RecordedAction, RecordedActionType } from "./types";

/**
 * Parses Playwright `codegen` output (JavaScript target) into structured,
 * human-readable {@link RecordedAction}s.
 *
 * The codegen output is plain string/regex-parseable — we deliberately do NOT
 * pull in a full JS parser. We look at one `await page.<locator>.<action>()`
 * statement per line.
 */

interface LocatorInfo {
  /** Human description of the element, e.g. "Submit button", "Email field". */
  target: string;
  /** Whether the element looks like a password input. */
  isPassword: boolean;
}

/**
 * Extracts a friendly target description from a chain of locator calls such as
 * `getByRole('button', { name: 'Submit' })` or `getByLabel('Email')`.
 */
function describeLocator(locatorChain: string): LocatorInfo {
  const lower = locatorChain.toLowerCase();
  const isPassword = lower.includes("password");

  // getByRole('button', { name: 'Submit' }) -> "Submit button"
  const role = locatorChain.match(
    /getByRole\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*\{[^}]*name:\s*['"`]([^'"`]+)['"`])?/,
  );
  if (role) {
    const roleName = role[1];
    const accessibleName = role[2];
    if (accessibleName) {
      return { target: `'${accessibleName}' ${roleName}`, isPassword };
    }
    return { target: `${roleName}`, isPassword };
  }

  const label = locatorChain.match(/getByLabel\(\s*['"`]([^'"`]+)['"`]/);
  if (label) return { target: `${label[1]} field`, isPassword };

  const placeholder = locatorChain.match(
    /getByPlaceholder\(\s*['"`]([^'"`]+)['"`]/,
  );
  if (placeholder) return { target: `${placeholder[1]} field`, isPassword };

  const text = locatorChain.match(/getByText\(\s*['"`]([^'"`]+)['"`]/);
  if (text) return { target: `'${text[1]}'`, isPassword };

  const testId = locatorChain.match(/getByTestId\(\s*['"`]([^'"`]+)['"`]/);
  if (testId) return { target: `${testId[1]}`, isPassword };

  const altText = locatorChain.match(/getByAltText\(\s*['"`]([^'"`]+)['"`]/);
  if (altText) return { target: `${altText[1]} image`, isPassword };

  const title = locatorChain.match(/getByTitle\(\s*['"`]([^'"`]+)['"`]/);
  if (title) return { target: `${title[1]}`, isPassword };

  // Fallback: raw CSS/text locator inside locator('...')
  const raw = locatorChain.match(/locator\(\s*['"`]([^'"`]+)['"`]/);
  if (raw) return { target: raw[1], isPassword };

  return { target: "element", isPassword };
}

const PASSWORD_MASK = "••••";

export function parsePlaywrightScript(code: string): RecordedAction[] {
  const actions: RecordedAction[] = [];
  const lines = code.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("await ") && !line.startsWith("await(")) continue;

    // --- navigate: await page.goto('url') ---
    const goto = line.match(/page\.goto\(\s*['"`]([^'"`]+)['"`]/);
    if (goto) {
      const url = goto[1];
      actions.push({
        type: "navigate",
        target: url,
        selector: `page.goto('${url}')`,
        humanText: `Navigate to ${url}`,
      });
      continue;
    }

    // --- assertions: await expect(...).toX() ---
    if (line.startsWith("await expect(")) {
      actions.push({
        type: "assert",
        target: "page",
        selector: line.replace(/^await\s+/, "").replace(/;$/, ""),
        humanText: `Verify: ${line.replace(/^await\s+/, "").replace(/;$/, "")}`,
      });
      continue;
    }

    // --- page-level press: await page.keyboard.press('Enter') ---
    const keyboard = line.match(/keyboard\.press\(\s*['"`]([^'"`]+)['"`]/);
    if (keyboard) {
      actions.push({
        type: "press",
        target: "keyboard",
        value: keyboard[1],
        selector: line.replace(/^await\s+/, "").replace(/;$/, ""),
        humanText: `Press the ${keyboard[1]} key`,
      });
      continue;
    }

    // Everything else: await page.<locatorChain>.<action>(args)
    // Split into locator chain and the terminal action.
    const action = line.match(
      /page\.(.+)\.(click|fill|press|check|uncheck|selectOption|dblclick|hover|setInputFiles|tap)\(([^]*)\)\s*;?$/,
    );
    if (!action) continue;

    const locatorChain = action[1];
    const verb = action[2];
    const argsRaw = action[3].trim();
    const selector = `page.${locatorChain}`;
    const { target, isPassword } = describeLocator(locatorChain);

    // Extract first string literal argument as a value, when present.
    const valueMatch = argsRaw.match(/^['"`]([^]*?)['"`]/);
    const value = valueMatch ? valueMatch[1] : undefined;
    const displayValue =
      isPassword && value !== undefined ? PASSWORD_MASK : value;

    let type: RecordedActionType = "other";
    let humanText = "";

    switch (verb) {
      case "click":
      case "dblclick":
      case "tap":
        type = "click";
        humanText = `${verb === "dblclick" ? "Double-click" : "Click"} the ${target}`;
        break;
      case "fill":
        type = "fill";
        humanText = `Type '${displayValue ?? ""}' into the ${target}`;
        break;
      case "press":
        type = "press";
        humanText = `Press '${value ?? ""}' in the ${target}`;
        break;
      case "check":
        type = "check";
        humanText = `Check the ${target}`;
        break;
      case "uncheck":
        type = "check";
        humanText = `Uncheck the ${target}`;
        break;
      case "selectOption":
        type = "select";
        humanText = `Select '${displayValue ?? ""}' from the ${target}`;
        break;
      case "hover":
        type = "other";
        humanText = `Hover over the ${target}`;
        break;
      case "setInputFiles":
        type = "other";
        humanText = `Upload a file to the ${target}`;
        break;
      default:
        type = "other";
        humanText = `${verb} on the ${target}`;
    }

    actions.push({
      type,
      target,
      value: displayValue,
      selector,
      humanText,
    });
  }

  return actions;
}
