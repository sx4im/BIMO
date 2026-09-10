import { el } from "../utils.js?v=30";

// Brand mark — BMO artwork (PNG)
export const MARK_PATHS = "";
export const MARK_VIEWBOX = "0 0 100 100";

export function brandMark() {
  return `<img src="/assets/logo.png" alt="BMO" class="logo-img" aria-hidden="true" />`;
}

// Kept as alias for legacy imports; same mark.
export function spikeMark() {
  return brandMark();
}

export function logo({ size = "md", withLabel = false, withMark = true } = {}) {
  return el(
    "a",
    {
      href: "#/",
      class: `logo ${size === "sm" ? "sm" : ""}`,
      "aria-label": "BMO",
    },
    [
      withMark
        ? el("span", { class: "mark" }, [
            el("img", {
              src: "/assets/logo.png",
              alt: "BMO",
              class: "logo-img",
              "aria-hidden": "true",
            }),
          ])
        : null,
      withLabel ? el("span", { class: "label" }) : null,
    ]
  );
}
