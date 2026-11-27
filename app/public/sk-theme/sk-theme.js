/* JIUZHANG SuperShell sk-theme 引导（二开工作台生成） */
(function () {
  var KEY = 'sk-theme';
  var root = document.documentElement;
  function current() {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* 隐私模式等，忽略 */ }
    return (saved === 'dark' || saved === 'brand') ? saved : 'light';
  }
  function set(theme) {
    if (theme !== 'dark' && theme !== 'brand') theme = 'light';
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) { /* 忽略 */ }
    return theme;
  }
  set(current());
  window.SKTheme = Object.freeze({ set: set, current: function () { return root.getAttribute('data-theme') || 'light'; } });
})();
