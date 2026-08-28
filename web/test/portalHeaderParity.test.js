import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

function ruleBody(css, selectorPattern) {
  const match = css.match(new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `No se encontró la regla ${selectorPattern}`);
  return match[1];
}

test("el header conserva la geometría, color y scroll sticky del Layout legacy", async () => {
  const css = await readFile(new URL("../src/styles/app.css", import.meta.url), "utf8");
  const shell = ruleBody(css, "\\.portal-shell");
  const header = ruleBody(css, "\\.portal-header");

  assert.match(shell, /height:\s*100vh/);
  assert.match(shell, /overflow-y:\s*auto/);
  assert.match(header, /position:\s*sticky/);
  assert.match(header, /top:\s*0/);
  assert.match(header, /height:\s*56px/);
  assert.match(header, /padding:\s*0 max\(40px, calc\(\(100% - 1280px\) \/ 2 \+ 40px\)\)/);
  assert.match(header, /background:\s*#444 !important/);
  assert.match(header, /box-shadow:\s*0 1px 5px 0 rgba\(21, 24, 26, 0\.1\)/);
});

test("logo, chevrons, país y sesión usan las medidas del header legacy", async () => {
  const css = await readFile(new URL("../src/styles/app.css", import.meta.url), "utf8");

  assert.match(ruleBody(css, "\\.legacy-brand img"), /width:\s*32px;\s*height:\s*32px;\s*margin-right:\s*8px/);
  assert.match(ruleBody(css, "\\.legacy-navigation"), /height:\s*56px/);
  assert.match(ruleBody(css, "\\.legacy-nav-item"), /padding:\s*0 22px 0 8px/);

  const chevron = ruleBody(css, "\\.legacy-nav-item::after");
  assert.match(chevron, /top:\s*24px/);
  assert.match(chevron, /right:\s*7px/);
  assert.match(chevron, /width:\s*6px/);
  assert.match(chevron, /height:\s*6px/);
  assert.match(chevron, /border-bottom:\s*1px solid #4f575e/);
  assert.match(chevron, /border-left:\s*1px solid #4f575e/);

  const hover = ruleBody(css, "\\.legacy-nav-item:hover,\\s*\\.legacy-nav-item:focus-visible");
  assert.match(hover, /border-bottom-color:\s*#4d5c66/);
  assert.doesNotMatch(hover, /background/);

  const flag = ruleBody(css, "\\.legacy-country-flag");
  assert.match(flag, /width:\s*24px/);
  assert.match(flag, /height:\s*24px/);
  assert.match(flag, /margin-right:\s*18px/);
  assert.match(flag, /border-radius:\s*50%/);
});

test("el logout replica Font Awesome sign-out y su texto accesible del bloque UserInfoIA", async () => {
  const source = await readFile(new URL("../src/layouts/PortalLayout.jsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/styles/app.css", import.meta.url), "utf8");

  assert.match(source, /className="fa fa-sign-out" aria-hidden="true"/);
  assert.match(source, /className="legacy-wcag-hide-text">Log out<\/span>/);
  assert.doesNotMatch(source, /LogoutOutlined/);

  const hiddenText = ruleBody(css, "\\.legacy-wcag-hide-text");
  assert.match(hiddenText, /clip:\s*rect\(0 0 0 0\)/);
  assert.match(hiddenText, /width:\s*1px/);
  assert.match(hiddenText, /height:\s*1px/);
  assert.match(ruleBody(css, "\\.legacy-logout \\.fa"), /font-size:\s*14px;\s*line-height:\s*14px/);
});

test("los binarios de logo y bandera Honduras coinciden con los publicados por el legacy", async () => {
  const fixtures = [
    ["../public/brand/logo.png", "92dfeb5beca63d6fadd1d855e99ece6d9773b310dd839707c8b5936b374f7fa6"],
    ["../public/brand/country-honduras.png", "dbe6b055b17d09f55b0d891039407db30b607cdc42dee5ab287a43eb2bcb5b49"],
  ];

  for (const [relativePath, expectedHash] of fixtures) {
    const bytes = await readFile(new URL(relativePath, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedHash);
  }
});
