// Game8 Beyond Categorical — entry point
// Minimal shell: handles start button, preserves theme for Pages availability.
(function () {
  'use strict';

  var btn = document.getElementById('start-btn');
  var status = document.getElementById('status');

  if (!btn || !status) return;

  btn.addEventListener('click', function () {
    status.textContent = '正在准备…';
    btn.disabled = true;
    btn.style.opacity = '0.5';
    setTimeout(function () {
      status.textContent = '核心玩法正在构建中，敬请期待。';
    }, 800);
  });
})();
