/**
 * Builds the healing shim code to prepend to generated test scripts.
 * The shim intercepts Playwright locator failures and calls back to the
 * parent process's heal server to get a replacement selector.
 */
export function buildHealingShim(healServerUrl: string): string {
  return `
// ---- Injected selector-healing shim ----
const __HEAL_URL = ${JSON.stringify(healServerUrl)};

async function __requestHeal(selector, errorMessage, domSnapshot) {
  try {
    const res = await fetch(__HEAL_URL + "/heal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selector, errorMessage, domSnapshot }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.healedSelector ?? null;
  } catch {
    return null;
  }
}

async function __extractDomCandidates(page, selector) {
  try {
    return await page.evaluate(() => {
      const TAILWIND_PATTERN = /^(flex|grid|block|inline|hidden|text-|bg-|border|p-|m-|w-|h-|rounded|shadow|font-|leading-|tracking-|space-|gap-|items-|justify-|overflow-|z-|opacity-|transition-|hover:|focus:|sm:|md:|lg:|xl:)/;
      function getClasses(el) {
        return Array.from(el.classList).filter(c => !TAILWIND_PATTERN.test(c)).slice(0, 3).join(" ").trim();
      }
      function getText(el) {
        return (el.innerText || "").trim().slice(0, 80);
      }
      const elements = document.querySelectorAll(
        "a, button, input, select, textarea, [role], [data-testid], [data-test], [data-cy], [aria-label]"
      );
      return Array.from(elements).map(el => {
        const c = { tag: el.tagName.toLowerCase() };
        const id = el.getAttribute("id"); if (id) c.id = id;
        const testId = el.getAttribute("data-testid") || el.getAttribute("data-test") || el.getAttribute("data-cy");
        if (testId) c.testId = testId;
        const role = el.getAttribute("role"); if (role) c.role = role;
        const ariaLabel = el.getAttribute("aria-label"); if (ariaLabel) c.ariaLabel = ariaLabel;
        const placeholder = el.getAttribute("placeholder"); if (placeholder) c.placeholder = placeholder;
        const text = getText(el); if (text) c.text = text;
        const classes = getClasses(el); if (classes) c.classes = classes;
        return c;
      });
    });
  } catch {
    return [];
  }
}

function __isLocatorError(err) {
  if (!err || typeof err.message !== "string") return false;
  const msg = err.message;
  return (
    msg.includes("locator") ||
    msg.includes("Locator") ||
    msg.includes("strict mode violation") ||
    msg.includes("selector") ||
    msg.includes("TimeoutError") ||
    msg.includes("waiting for") ||
    msg.includes("not found") ||
    msg.includes("no element")
  );
}

function __wrapPage(page) {
  const METHODS_WITH_SELECTOR = ["locator", "click", "fill", "getByTestId", "getByRole", "getByLabel", "getByText", "getByPlaceholder"];

  return new Proxy(page, {
    get(target, prop) {
      const val = target[prop];

      if (prop === "locator" || prop === "getByTestId" || prop === "getByRole" ||
          prop === "getByLabel" || prop === "getByText" || prop === "getByPlaceholder") {
        return function(...args) {
          const locator = val.apply(target, args);
          const selectorStr = typeof args[0] === "string" ? args[0] : String(args[0]);

          return new Proxy(locator, {
            get(lTarget, lProp) {
              const lVal = lTarget[lProp];
              if (typeof lVal !== "function") return lVal;

              if (["click", "fill", "type", "check", "uncheck", "selectOption",
                   "focus", "hover", "press", "tap", "isVisible", "isEnabled",
                   "isChecked", "innerText", "innerHTML", "inputValue",
                   "textContent", "getAttribute", "waitFor"].includes(String(lProp))) {
                return async function(...lArgs) {
                  try {
                    return await lVal.apply(lTarget, lArgs);
                  } catch (err) {
                    if (!__isLocatorError(err)) throw err;

                    const domSnapshot = await __extractDomCandidates(page, selectorStr);
                    const healedSelector = await __requestHeal(
                      selectorStr,
                      err.message,
                      domSnapshot
                    );

                    if (!healedSelector) throw err;

                    // Retry with healed selector
                    try {
                      const healedLocator = page.locator(healedSelector);
                      return await healedLocator[lProp](...lArgs);
                    } catch {
                      throw err; // rethrow original
                    }
                  }
                };
              }

              return lVal;
            }
          });
        };
      }

      if (prop === "click" || prop === "fill") {
        if (typeof val === "function") {
          return async function(...args) {
            try {
              return await val.apply(target, args);
            } catch (err) {
              if (!__isLocatorError(err) || typeof args[0] !== "string") throw err;

              const selectorStr = args[0];
              const domSnapshot = await __extractDomCandidates(page, selectorStr);
              const healedSelector = await __requestHeal(selectorStr, err.message, domSnapshot);

              if (!healedSelector) throw err;

              try {
                return await target[prop](healedSelector, ...args.slice(1));
              } catch {
                throw err;
              }
            }
          };
        }
      }

      return typeof val === "function" ? val.bind(target) : val;
    }
  });
}

// Override browser.newPage() to wrap the returned page
const __origNewPage = globalThis.__playwrightBrowserOverride;

// Hook into playwright context — intercept at the browser context level
const __originalBrowserType = globalThis.__healingShimInstalled;
if (!globalThis.__healingShimInstalled) {
  globalThis.__healingShimInstalled = true;

  // We'll intercept by overriding the module-level 'chromium' / 'firefox' / 'webkit'
  // At script evaluation time, the shim patches browser.newPage after launch
  const __patchBrowser = (browser) => {
    const origNewContext = browser.newContext?.bind(browser);
    const origNewPage = browser.newPage?.bind(browser);

    if (origNewPage) {
      browser.newPage = async function(...args) {
        const page = await origNewPage(...args);
        return __wrapPage(page);
      };
    }

    if (origNewContext) {
      browser.newContext = async function(...args) {
        const ctx = await origNewContext(...args);
        const origCtxNewPage = ctx.newPage?.bind(ctx);
        if (origCtxNewPage) {
          ctx.newPage = async function(...ctxArgs) {
            const page = await origCtxNewPage(...ctxArgs);
            return __wrapPage(page);
          };
        }
        return ctx;
      };
    }

    return browser;
  };

  // Patch playwright imports by intercepting at the chromium.launch level
  // We do this by wrapping the playwright module exports
  try {
    const __pw = await import("playwright");
    for (const browserType of ["chromium", "firefox", "webkit"]) {
      if (__pw[browserType]) {
        const origLaunch = __pw[browserType].launch.bind(__pw[browserType]);
        __pw[browserType].launch = async function(...args) {
          const browser = await origLaunch(...args);
          return __patchBrowser(browser);
        };
      }
    }
  } catch {
    // playwright not available at shim init — that's ok, test code imports it separately
  }
}
// ---- End selector-healing shim ----
`;
}
