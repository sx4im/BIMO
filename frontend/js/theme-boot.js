// Apply theme before first paint (must load from 'self' — CSP blocks inline scripts).
// Default is DARK when nothing is stored yet (existing + new users); an explicit
// "system"/"light" choice is always honoured.
(function () {
  try {
    var t = localStorage.getItem("bimo-theme") || "dark";
    var dark =
      t === "dark" ||
      (t === "system" &&
        window.matchMedia &&
        !window.matchMedia("(prefers-color-scheme: light)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
