/*
 * MoneyPilot – Diagramme
 *
 * Kleine, selbst gezeichnete SVG-Diagramme. Es wird keine externe Bibliothek
 * benötigt, die App funktioniert daher auch ohne Internet.
 */
(function (global) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SERIES = { income: '#17744f', expenses: '#b8862f' };

  function el(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  /* ---------- Tooltip (gemeinsam für alle Diagramme) ---------- */
  var tooltip = null;

  function ensureTooltip() {
    if (tooltip) return tooltip;
    tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    tooltip.setAttribute('role', 'status');
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function showTip(event, html) {
    var tip = ensureTooltip();
    tip.innerHTML = html;
    tip.classList.add('visible');
    var x = event.clientX + 14;
    var y = event.clientY + 14;
    var rect = tip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - 14;
    if (y + rect.height > window.innerHeight - 8) y = event.clientY - rect.height - 14;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  }

  function hideTip() {
    if (tooltip) tooltip.classList.remove('visible');
  }

  function bindTip(node, html, onEnter, onLeave) {
    node.addEventListener('pointermove', function (e) { showTip(e, html); if (onEnter) onEnter(); });
    node.addEventListener('pointerleave', function () { hideTip(); if (onLeave) onLeave(); });
  }

  /* ---------- Ringdiagramm: Ausgaben nach Kategorie ---------- */
  /**
   * data: [{ label, value, color }] – value in Cent
   */
  function donut(container, data, centerLabel) {
    var C = global.MPCalc;
    container.innerHTML = '';
    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    if (!total) {
      container.innerHTML = '<p class="empty">Noch keine Ausgaben in diesem Monat.</p>';
      return;
    }

    var size = 200, radius = 80, stroke = 18, gap = 2;
    var circumference = 2 * Math.PI * radius;
    var svg = el('svg', {
      viewBox: '0 0 ' + size + ' ' + size, class: 'donut',
      role: 'img', 'aria-label': 'Ausgaben nach Kategorie, insgesamt ' + C.formatEuro(total)
    });
    var group = el('g', { transform: 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')' });
    svg.appendChild(group);

    var offset = 0;
    data.forEach(function (d) {
      var length = (d.value / total) * circumference;
      var visible = data.length > 1 ? Math.max(0.5, length - gap) : length;
      var segment = el('circle', {
        cx: size / 2, cy: size / 2, r: radius, fill: 'none',
        stroke: d.color, 'stroke-width': stroke,
        'stroke-dasharray': visible + ' ' + (circumference - visible),
        'stroke-dashoffset': -offset,
        class: 'donut-segment'
      });
      var share = Math.round((d.value / total) * 100);
      bindTip(segment, '<strong>' + d.label + '</strong><br>' + C.formatEuro(d.value) + ' · ' + share + ' %');
      group.appendChild(segment);
      offset += length;
    });

    var label = el('text', { x: size / 2, y: size / 2 - 6, 'text-anchor': 'middle', class: 'donut-label' });
    label.textContent = centerLabel || 'Ausgaben';
    var value = el('text', { x: size / 2, y: size / 2 + 18, 'text-anchor': 'middle', class: 'donut-value' });
    value.textContent = C.formatEuro(total);
    svg.appendChild(label);
    svg.appendChild(value);

    var legend = document.createElement('ul');
    legend.className = 'legend legend-list';
    data.forEach(function (d) {
      var li = document.createElement('li');
      var share = Math.round((d.value / total) * 100);
      li.innerHTML = '<span class="swatch" style="background:' + d.color + '"></span>' +
        '<span class="legend-name">' + d.label + '</span>' +
        '<span class="legend-value">' + C.formatEuro(d.value) + '</span>' +
        '<span class="legend-share">' + share + ' %</span>';
      legend.appendChild(li);
    });

    var wrap = document.createElement('div');
    wrap.className = 'donut-wrap';
    wrap.appendChild(svg);
    wrap.appendChild(legend);
    container.appendChild(wrap);
  }

  /* ---------- Balkendiagramm: Einnahmen und Ausgaben je Monat ---------- */
  function niceMax(value) {
    if (value <= 0) return 100000;
    var magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) {
      if (steps[i] * magnitude >= value) return steps[i] * magnitude;
    }
    return 10 * magnitude;
  }

  /** Balken mit 4px abgerundetem oberen Ende, unten flach auf der Grundlinie */
  function barPath(x, y, w, h) {
    var r = Math.min(4, w / 2, h);
    return 'M' + x + ',' + (y + h) +
      'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
      'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
      'V' + (y + h) + 'Z';
  }

  /**
   * series: [{ key, income, expenses }] – Beträge in Cent
   */
  function incomeExpenseBars(container, series) {
    var C = global.MPCalc;
    container.innerHTML = '';
    // Das Diagramm wird in der echten Breite gezeichnet, damit die Schrift
    // auf Handy und Desktop gleich groß und gut lesbar bleibt.
    var width = Math.max(300, Math.round(container.clientWidth || 640));
    var height = width < 560 ? 240 : 300;
    var pad = { top: 16, right: 8, bottom: 34, left: 64 };
    var innerW = width - pad.left - pad.right;
    var innerH = height - pad.top - pad.bottom;
    var maxValue = niceMax(Math.max.apply(null, series.map(function (m) { return Math.max(m.income, m.expenses); })));
    var y = function (v) { return pad.top + innerH - (v / maxValue) * innerH; };

    var svg = el('svg', {
      viewBox: '0 0 ' + width + ' ' + height, class: 'bars', role: 'img',
      'aria-label': 'Einnahmen und Ausgaben der letzten ' + series.length + ' Monate'
    });

    // Hilfslinien und Achsenbeschriftung
    for (var t = 0; t <= 4; t++) {
      var value = (maxValue / 4) * t;
      var gy = y(value);
      svg.appendChild(el('line', { x1: pad.left, x2: width - pad.right, y1: gy, y2: gy, class: t === 0 ? 'axis' : 'grid' }));
      var tick = el('text', { x: pad.left - 8, y: gy + 4, 'text-anchor': 'end', class: 'tick' });
      tick.textContent = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value / 100) + ' €';
      svg.appendChild(tick);
    }

    var groupW = innerW / series.length;
    var barW = Math.min(26, groupW * 0.28);
    series.forEach(function (m, i) {
      var cx = pad.left + groupW * i + groupW / 2;
      var g = el('g', { class: 'bar-group' });

      var hover = el('rect', { x: pad.left + groupW * i, y: pad.top, width: groupW, height: innerH, class: 'hover-band' });
      g.appendChild(hover);

      [['income', cx - barW - 1], ['expenses', cx + 1]].forEach(function (pair) {
        var v = m[pair[0]];
        if (v > 0) {
          var h = innerH - (y(v) - pad.top);
          g.appendChild(el('path', { d: barPath(pair[1], y(v), barW, h), fill: SERIES[pair[0]], class: 'bar' }));
        }
      });

      var label = el('text', { x: cx, y: height - 10, 'text-anchor': 'middle', class: 'tick' });
      label.textContent = C.monthShortLabel(m.key);
      g.appendChild(label);

      var balance = m.income - m.expenses;
      bindTip(g,
        '<strong>' + C.monthLabel(m.key) + '</strong>' +
        '<div class="tip-row"><span class="swatch" style="background:' + SERIES.income + '"></span>Einnahmen <b>' + C.formatEuro(m.income) + '</b></div>' +
        '<div class="tip-row"><span class="swatch" style="background:' + SERIES.expenses + '"></span>Ausgaben <b>' + C.formatEuro(m.expenses) + '</b></div>' +
        '<div class="tip-row">Saldo <b>' + C.formatEuro(balance) + '</b></div>',
        function () { g.classList.add('active'); },
        function () { g.classList.remove('active'); });
      svg.appendChild(g);
    });

    var legend = document.createElement('div');
    legend.className = 'legend legend-inline';
    legend.innerHTML =
      '<span><span class="swatch" style="background:' + SERIES.income + '"></span>Einnahmen</span>' +
      '<span><span class="swatch" style="background:' + SERIES.expenses + '"></span>Ausgaben</span>';
    container.appendChild(legend);
    container.appendChild(svg);
  }

  global.MPCharts = { donut: donut, incomeExpenseBars: incomeExpenseBars, hideTip: hideTip };
})(this);
