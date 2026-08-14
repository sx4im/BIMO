// Apply theme before first paint (must load from 'self' — CSP blocks inline scripts).
(function () {
  try {
    var t = localStorage.getItem("bimo-theme") || "system";
    var dark =
      t === "dark" ||
      (t === "system" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {}
})();
