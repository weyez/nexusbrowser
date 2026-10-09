// Applies the saved theme before first paint (external file so CSP can forbid inline scripts).
try {
  var c = localStorage.getItem("nexus.themeClass");
  if (c === "light") document.documentElement.classList.remove("dark");
} catch (e) {}
