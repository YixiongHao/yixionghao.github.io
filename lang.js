/* Bilingual (EN / 中文) switch.
   Loaded synchronously in <head> so the stored language is applied before
   first paint (no flash of the wrong language).

   Convention: every translatable block in <main> appears twice, adjacent,
   tagged lang="en" and lang="zh". styles.css hides the inactive one based on
   the .zh class on <html>. Short labels inside single elements (nav links,
   h2 with an id, dates) use a pair of <span lang="…"> instead. */
(function () {
  var KEY = 'lang';
  var root = document.documentElement;

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function apply(lang) {
    var zh = lang === 'zh';
    root.classList.toggle('zh', zh);
    root.lang = zh ? 'zh-CN' : 'en';
    var t = document.querySelector('title');
    if (t) {
      if (!t.dataset.en) t.dataset.en = t.textContent;
      if (zh && t.dataset.zh) t.textContent = t.dataset.zh;
      else t.textContent = t.dataset.en;
    }
    var buttons = document.querySelectorAll('.lang-toggle button');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false');
    }
  }

  function set(lang) {
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    apply(lang);
  }

  // Initial language: stored preference, else the browser's language.
  var initial = stored();
  if (initial !== 'en' && initial !== 'zh') {
    initial = /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
  }
  root.classList.toggle('zh', initial === 'zh');
  root.lang = initial === 'zh' ? 'zh-CN' : 'en';

  document.addEventListener('DOMContentLoaded', function () {
    apply(initial);
    var buttons = document.querySelectorAll('.lang-toggle button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () { set(this.dataset.lang); });
    }
  });
})();
