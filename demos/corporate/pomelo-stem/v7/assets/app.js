(function () {
  'use strict';
  var root = document.documentElement;
  root.dataset.pomeloApp = 'ready';
  var theme = document.querySelector('[data-theme-toggle]');
  function syncTheme() {
    if (!theme) return;
    var dark = root.dataset.theme === 'dark';
    theme.setAttribute('aria-pressed', String(dark));
    theme.setAttribute('aria-label', dark ? theme.dataset.light : theme.dataset.dark);
    theme.setAttribute('title', dark ? theme.dataset.light : theme.dataset.dark);
  }
  if (theme) theme.addEventListener('click', function () {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('pomelo-v7-theme', root.dataset.theme); } catch (_) {}
    syncTheme();
  });
  syncTheme();
  document.querySelectorAll('[data-locale]').forEach(function (link) { link.addEventListener('click', function () { try { localStorage.setItem('pomelo-v7-language', link.dataset.locale); } catch (_) {} }); });
  document.querySelectorAll('[data-demo-form]').forEach(function (form) {
    var fields = form.querySelector('[data-demo-fields]');
    var result = form.querySelector('[data-demo-result]');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      result.textContent = form.dataset.result;
      result.hidden = false;
    });
    fields.disabled = false;
  });
  document.querySelectorAll('[data-product-tour]').forEach(function (tour) {
    var tablist = tour.querySelector('[data-tour-tabs]');
    var tabs = Array.from(tour.querySelectorAll('[data-tour-tab]'));
    var panels = Array.from(tour.querySelectorAll('[data-tour-panel]'));
    function show(index, focus) {
      tabs.forEach(function (tab, i) { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
      panels.forEach(function (panel, i) { panel.hidden = i !== index; });
      if (focus) tabs[index].focus();
    }
    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { show(index, false); });
      tab.addEventListener('keydown', function (event) {
        var next = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + tabs.length - 1) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault(); show(next, true);
      });
    });
    function syncOrientation() { tablist.setAttribute('aria-orientation', matchMedia('(max-width: 900px)').matches ? 'horizontal' : 'vertical'); }
    syncOrientation(); window.addEventListener('resize', syncOrientation);
    show(0, false); tour.classList.add('tour-enabled'); tablist.hidden = false;
  });
  document.querySelectorAll('[data-scene-switch]').forEach(function (group) {
    var controls = group.querySelector('[data-scene-buttons]');
    var visual = group.closest('.showcase-visual');
    var buttons = Array.from(group.dataset.sceneKind === '0' ? visual.querySelectorAll('[data-product-button]') : group.querySelectorAll('[data-scene-button]'));
    var details = Array.from(group.querySelectorAll('[data-scene-detail]'));
    var status = group.querySelector('[data-scene-status]');
    var tour = group.closest('[data-product-tour]');
    function select(index, announce) {
      buttons.forEach(function (button, i) {
        button.setAttribute('aria-pressed', String(i === index));
        var state = button.querySelector('[data-product-state]');
        if (state) { state.textContent = i === index ? button.dataset.selectedLabel : button.dataset.viewLabel; state.hidden = false; }
      });
      details.forEach(function (detail, i) { detail.hidden = i !== index; });
      if (group.dataset.sceneKind === '1' && index > 0) {
        var deliveryIndex = document.querySelector('[data-index-delivery-status]');
        var deliveryStatus = details[index].querySelector('.sample-order-head .pill');
        if (deliveryIndex && deliveryStatus) deliveryIndex.textContent = deliveryStatus.textContent;
      }
      if (group.dataset.sceneKind === '0') {
        tour.querySelectorAll('[data-studio-product]').forEach(function (listing, i) { listing.hidden = i !== index; });
      }
      var prompt = visual.querySelector('.tour-message-user');
      var answer = visual.querySelector('.tour-message-answer p');
      if (announce) {
        var selectedDetail = group.dataset.sceneKind === '1' && index === 0 ? details[index].querySelector('[data-studio-product]:not([hidden])') : details[index];
        var title = selectedDetail.querySelector('.selected-product strong, .sample-order-head strong, strong');
        var value = selectedDetail.querySelector('.demo-product-price, .sample-order-head .pill');
        var example = group.dataset.sceneKind === '2' ? details[index].querySelector('p') : null;
        status.textContent = group.dataset.selectedLabel + ': ' + (title ? title.textContent : '') + (value ? ' · ' + value.textContent : '') + (example ? ' · ' + example.textContent : '');
      }
      if (prompt && answer) {
        prompt.textContent = details[index].querySelector('strong').textContent;
        answer.textContent = details[index].querySelector('p').textContent;
      }
    }
    buttons.forEach(function (button, index) {
      button.addEventListener('click', function () { select(index, true); });
      button.disabled = false;
    });
    select(0);
    group.querySelectorAll('[data-view-studio]').forEach(function (link) {
      link.addEventListener('click', function () {
        tour.querySelector('[data-tour-tab="1"]').click();
        var productScene = tour.querySelector('[data-scene-kind="1"] [data-scene-button="0"]');
        productScene.click();
        productScene.focus();
      });
      link.hidden = false;
    });
    if (controls) controls.hidden = false;
    var productHint = visual.querySelector('[data-product-hint]');
    if (productHint) productHint.hidden = false;
  });
  document.querySelectorAll('[data-estimator]').forEach(function (example) {
    var product = example.querySelector('[data-estimate-product]');
    var quantity = example.querySelector('[data-estimate-quantity]');
    var total = example.querySelector('[data-estimate-total]');
    var breakdown = example.querySelector('[data-estimate-breakdown]');
    function update() {
      var cents = Number(product.value) * Number(quantity.value);
      total.textContent = 'RM ' + (cents / 100).toFixed(2);
      if (breakdown) breakdown.textContent = 'RM ' + (Number(product.value) / 100).toFixed(2) + ' × ' + quantity.value;
    }
    document.querySelectorAll('[data-estimate-choice]').forEach(function (button) {
      button.addEventListener('click', function () {
        product.selectedIndex = Number(button.dataset.estimateChoice);
        update();
        product.focus();
      });
      button.hidden = false;
    });
    product.addEventListener('change', update);
    quantity.addEventListener('change', update);
    product.disabled = false;
    quantity.disabled = false;
    update();
  });
  document.querySelectorAll('[data-comparison]').forEach(function (comparison) {
    var first = comparison.querySelector('[data-compare-first]');
    var second = comparison.querySelector('[data-compare-second]');
    var cards = comparison.querySelectorAll('[data-compare-card]');
    function update() {
      var same = first.value === second.value;
      cards.forEach(function (card) {
        var isFirst = card.dataset.compareCard === first.value;
        var isSecond = card.dataset.compareCard === second.value;
        card.hidden = !isFirst && !isSecond;
        var position = card.querySelector && card.querySelector('[data-compare-position]');
        if (position) {
          position.textContent = isFirst && isSecond ? comparison.dataset.firstLabel + ' / ' + comparison.dataset.secondLabel : isFirst ? comparison.dataset.firstLabel : comparison.dataset.secondLabel;
          position.hidden = card.hidden;
          card.setAttribute('aria-labelledby', 'compare-position-' + card.dataset.compareCard + ' compare-name-' + card.dataset.compareCard);
        }
      });
      var sameNotice = comparison.querySelector('[data-compare-same]');
      if (sameNotice) sameNotice.hidden = !same;
      // Move the actual articles so visual and assistive-technology reading order agree.
      var ordered = Array.from(cards);
      ordered.sort(function (a, b) {
        function rank(card) { return card.dataset.compareCard === first.value ? 0 : card.dataset.compareCard === second.value ? 1 : 2; }
        return rank(a) - rank(b);
      });
      if (ordered[0] && ordered[0].parentNode) ordered.forEach(function (card) { card.parentNode.appendChild(card); });
    }
    document.querySelectorAll('[data-compare-choice]').forEach(function (button) {
      button.addEventListener('click', function () {
        first.value = button.dataset.compareChoice;
        update();
        first.focus();
      });
      button.hidden = false;
    });
    first.addEventListener('change', update);
    second.addEventListener('change', update);
    first.disabled = false;
    second.disabled = false;
    update();
  });
  document.querySelectorAll('[data-open-delivery]').forEach(function (link) {
    link.addEventListener('click', function () {
      var tab = document.querySelector('[data-tour-tab="1"]');
      var scene = document.querySelector('[data-scene-kind="1"] [data-scene-button="1"]');
      if (tab && scene) {
        tab.click(); scene.click();
        var target = document.querySelector('#scene-1-1');
        if (target) target.focus({ preventScroll: true });
      }
    });
  });
  document.querySelectorAll('[data-pickup-example]').forEach(function (example) {
    var checks = Array.from(example.querySelectorAll('[data-prep-check]'));
    var statuses = example.querySelectorAll('[data-pickup-status]');
    var announcement = example.querySelector('[data-pickup-announcement]');
    var progress = example.querySelectorAll('[data-prep-progress]');
    var collected = example.querySelector('[data-pickup-collected]');
    var reset = example.querySelector('[data-pickup-reset]');
    function update(resetNotice) {
      var ready = checks.every(function (item) { return item.checked; });
      if (!ready) collected.checked = false;
      collected.disabled = !ready;
      var status = collected.checked ? example.dataset.collected : ready ? example.dataset.ready : example.dataset.preparing;
      statuses.forEach(function (label) { label.textContent = status; });
      var indexStatus = document.querySelector('[data-index-pickup-status]');
      if (indexStatus) indexStatus.textContent = status;
      progress.forEach(function (label) { label.textContent = checks.filter(function (item) { return item.checked; }).length + ' / ' + checks.length; });
      announcement.textContent = (resetNotice === true ? example.dataset.resetDone + ' · ' : '') + status + (example.dataset.progressLabel ? ' · ' + example.dataset.progressLabel + ': ' + checks.filter(function (item) { return item.checked; }).length + ' / ' + checks.length : '');
    }
    checks.forEach(function (check) {
      check.disabled = false;
      check.addEventListener('change', update);
    });
    collected.addEventListener('change', update);
    if (reset) {
      reset.disabled = false;
      reset.addEventListener('click', function () {
        checks.forEach(function (check) { check.checked = false; });
        collected.checked = false;
        update(true);
      });
    }
  });
  document.querySelectorAll('details.panel').forEach(function (panel) {
    panel.addEventListener('toggle', function () {
      if (panel.open) document.querySelectorAll('details.panel[open]').forEach(function (other) { if (other !== panel) other.open = false; });
    });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') document.querySelectorAll('details.panel[open]').forEach(function (panel) { panel.open = false; panel.querySelector('summary').focus(); });
  });
  window.addEventListener('load', function () { root.classList.remove('booting'); }, { once: true });
})();
