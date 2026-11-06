// Language toggle helpers. The chosen language stays in this browser only (privacy policy §10).
(function () {
  var KEY = 'nodii.lang';

  // Remember the language a visitor picks in the header toggle or footer.
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[data-lang]');
    if (!link) return;
    try {
      localStorage.setItem(KEY, link.getAttribute('data-lang'));
    } catch (e) {}
  });

  // Demo checks on the landing page: toggle a sprout check on click.
  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('button.check');
    if (!button) return;
    var done = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', done ? 'false' : 'true');
  });
})();
