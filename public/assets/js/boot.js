/* Runs before paint (blocking <script> in <head>).
   1. Applies the saved/system theme before first paint, so light-theme users
      do not get a dark flash.
   2. Adds `.reveal-on` so the scroll-reveal hidden state only applies when JS
      is alive; if scripts fail entirely, content stays visible instead of
      trapped. A failsafe reveals everything if the app never initializes. */
(function () {
  try {
    var saved = localStorage.getItem("shortly.theme");
    var theme = saved || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    /* localStorage blocked; keep the default theme */
  }
})();
document.documentElement.classList.add("reveal-on");

window.addEventListener("load", function () {
  setTimeout(function () {
    if (!window.__shortlyReady) {
      document.querySelectorAll("[data-reveal]").forEach(function (el) {
        el.classList.add("is-visible");
      });
    }
  }, 2500);
});
