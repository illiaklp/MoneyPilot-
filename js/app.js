/*
 * MoneyPilot – App-Logik
 *
 * Diese Datei verbindet alles: Sie liest die Daten (storage.js), rechnet
 * (calculations.js), zeichnet Diagramme (charts.js) und reagiert auf Klicks
 * und Formulare.
 */
(function () {
  'use strict';

  var C = window.MPCalc;
  var S = window.MPStorage;
  var Charts = window.MPCharts;

  var PAGES = ['uebersicht', 'buchungen', 'sparziele', 'statistik', 'spartipps'];
  var PAGES_WITH_MONTH = ['uebersicht', 'buchungen', 'statistik'];

  var state = S.load();
  var ui = {
    page: 'uebersicht',
    month: C.monthKeyOf(S.todayString()),
    filter: 'all'
  };

  /* ---------- Hilfsfunktionen ---------- */

  function $(id) { return document.getElementById(id); }

  /** Schützt vor HTML in Benutzereingaben (z. B. in Beschreibungen). */
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function persist() {
    if (!S.save(state)) toast('Achtung: Daten konnten nicht gespeichert werden.');
    render();
  }

  var toastTimer = null;
  function toast(message) {
    var node = $('toast');
    node.textContent = message;
    node.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('visible'); }, 2600);
  }

  function categoryInfo(type, id) {
    var list = S.CATEGORIES[type] || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return { id: id, icon: '•', color: '#8a8a80' };
  }

  function hasSamples() {
    return state.transactions.some(function (t) { return t.sample; }) ||
      state.goals.some(function (g) { return g.sample; }) || state.sampleBudget;
  }

  function sampleBadge(item) {
    return item.sample ? '<span class="badge-sample">Beispiel</span>' : '';
  }

  function signedEuro(cents) {
    return (cents > 0 ? '+' : cents < 0 ? '−' : '') + C.formatEuro(Math.abs(cents));
  }

  /* ---------- Navigation ---------- */

  function readPageFromHash() {
    var hash = window.location.hash.replace('#', '');
    ui.page = PAGES.indexOf(hash) !== -1 ? hash : 'uebersicht';
  }

  function renderNavigation() {
    PAGES.forEach(function (p) {
      $('page-' + p).hidden = p !== ui.page;
    });
    document.querySelectorAll('.main-nav a').forEach(function (a) {
      var active = a.getAttribute('data-page') === ui.page;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('month-bar').hidden = PAGES_WITH_MONTH.indexOf(ui.page) === -1;
    $('month-title').textContent = C.monthLabel(ui.month);
    $('this-month-btn').hidden = ui.month === C.monthKeyOf(S.todayString());
    $('sample-banner').hidden = !hasSamples();
  }

  /* ---------- Übersicht ---------- */

  function kpiCard(label, value, note, modifier) {
    return '<div class="kpi ' + (modifier || '') + '">' +
      '<span class="kpi-label">' + label + '</span>' +
      '<span class="kpi-value">' + value + '</span>' +
      (note ? '<span class="kpi-note">' + note + '</span>' : '') +
      '</div>';
  }

  function renderOverview() {
    var summary = C.monthSummary(state.transactions, state.budgets, ui.month);

    var budgetNote;
    var budgetValue;
    var budgetModifier = 'kpi-accent';
    if (summary.budget === null) {
      budgetValue = '–';
      budgetNote = 'Noch kein Budget festgelegt';
    } else if (summary.budgetRemaining < 0) {
      budgetValue = C.formatEuro(summary.budgetRemaining);
      budgetNote = '⚠ Budget um ' + C.formatEuro(-summary.budgetRemaining) + ' überschritten';
      budgetModifier = 'kpi-accent kpi-over';
    } else {
      budgetValue = C.formatEuro(summary.budgetRemaining);
      budgetNote = 'von ' + C.formatEuro(summary.budget) + ' noch verfügbar';
    }

    $('kpis').innerHTML =
      kpiCard('Verfügbares Budget', budgetValue, budgetNote, budgetModifier) +
      kpiCard('Einnahmen', C.formatEuro(summary.income), 'in diesem Monat') +
      kpiCard('Ausgaben', C.formatEuro(summary.expenses), 'in diesem Monat') +
      kpiCard('Saldo', signedEuro(summary.balance), 'Einnahmen minus Ausgaben');

    // Budget-Karte mit Fortschrittsbalken
    var budgetHtml;
    if (summary.budget === null) {
      budgetHtml = '<p class="muted">Lege fest, wie viel du in diesem Monat höchstens ausgeben möchtest.</p>';
    } else {
      var used = Math.min(100, summary.budgetUsedPercent);
      var over = summary.budgetRemaining < 0;
      var warn = !over && summary.budgetUsedPercent >= 80;
      budgetHtml =
        '<div class="budget-numbers">' +
          '<span><strong>' + C.formatEuro(summary.expenses) + '</strong> ausgegeben</span>' +
          '<span>Budget: <strong>' + C.formatEuro(summary.budget) + '</strong>' +
          (state.sampleBudget ? ' <span class="badge-sample">Beispiel</span>' : '') + '</span>' +
        '</div>' +
        '<div class="progress' + (over ? ' progress-over' : warn ? ' progress-warn' : '') + '" role="progressbar" ' +
          'aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + summary.budgetUsedPercent + '" aria-label="Budget verbraucht">' +
          '<span style="width:' + used + '%"></span></div>' +
        '<p class="budget-status">' +
          (over ? '⚠ Du hast dein Budget um <strong>' + C.formatEuro(-summary.budgetRemaining) + '</strong> überschritten.'
               : (warn ? '⚠ ' : '') + summary.budgetUsedPercent + ' % verbraucht – noch <strong>' +
                 C.formatEuro(summary.budgetRemaining) + '</strong> übrig.') +
        '</p>';
    }
    $('budget-card').innerHTML = budgetHtml;
    var budgetInput = $('budget-input');
    if (document.activeElement !== budgetInput) {
      budgetInput.value = summary.budget === null ? '' :
        new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(summary.budget / 100);
    }

    // Ringdiagramm
    var monthTx = C.transactionsForMonth(state.transactions, ui.month);
    var byCategory = C.expensesByCategory(monthTx).map(function (c) {
      return { label: c.category, value: c.amount, color: categoryInfo('expense', c.category).color };
    });
    Charts.donut($('donut-chart'), byCategory, 'Ausgaben');

    // Letzte Buchungen
    var recent = monthTx.slice().sort(sortByDateDesc).slice(0, 5);
    $('recent-list').innerHTML = recent.length
      ? recent.map(function (t) { return txItem(t, false); }).join('')
      : '<li class="empty">Keine Buchungen in diesem Monat.</li>';

    // Sparziele kompakt
    $('goals-mini').innerHTML = state.goals.length
      ? state.goals.map(function (g) {
          var p = C.goalProgress(g, S.todayString());
          return '<div class="goal-mini">' +
            '<div class="goal-mini-head"><span>' + escapeHtml(g.name) + ' ' + sampleBadge(g) + '</span>' +
            '<span class="muted">' + p.percent + ' %</span></div>' +
            '<div class="progress progress-thin"><span style="width:' + p.percent + '%"></span></div>' +
            '<div class="muted small">' + C.formatEuro(p.saved) + ' von ' + C.formatEuro(g.target) + '</div>' +
            '</div>';
        }).join('')
      : '<p class="empty">Noch keine Sparziele. <a class="link" href="#sparziele">Jetzt anlegen</a></p>';
  }

  /* ---------- Buchungen ---------- */

  function sortByDateDesc(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  }

  function txItem(t, withDelete) {
    var info = categoryInfo(t.type, t.category);
    var sign = t.type === 'income' ? '+' : '−';
    return '<li class="tx">' +
      '<span class="tx-icon" aria-hidden="true">' + info.icon + '</span>' +
      '<span class="tx-main">' +
        '<span class="tx-title">' + escapeHtml(t.description || t.category) + ' ' + sampleBadge(t) + '</span>' +
        '<span class="tx-meta">' + escapeHtml(t.category) + ' · ' + C.formatDate(t.date) + '</span>' +
      '</span>' +
      '<span class="tx-amount ' + (t.type === 'income' ? 'is-income' : 'is-expense') + '">' +
        sign + ' ' + C.formatEuro(t.amount) + '</span>' +
      (withDelete ? '<button type="button" class="icon-btn icon-btn-small" data-action="delete-tx" data-id="' + t.id +
        '" aria-label="Buchung löschen" title="Löschen">✕</button>' : '') +
      '</li>';
  }

  function fillCategorySelect() {
    var type = document.querySelector('input[name="type"]:checked').value;
    var select = $('tx-category');
    var previous = select.value;
    select.innerHTML = S.CATEGORIES[type].map(function (c) {
      return '<option value="' + c.id + '">' + c.icon + ' ' + c.id + '</option>';
    }).join('');
    if (S.CATEGORIES[type].some(function (c) { return c.id === previous; })) select.value = previous;
  }

  function defaultDateForMonth() {
    var today = S.todayString();
    return C.monthKeyOf(today) === ui.month ? today : ui.month + '-01';
  }

  function renderTransactions() {
    var monthTx = C.transactionsForMonth(state.transactions, ui.month).sort(sortByDateDesc);
    var filtered = monthTx.filter(function (t) { return ui.filter === 'all' || t.type === ui.filter; });
    $('tx-list-title').textContent = 'Buchungen im ' + C.monthLabel(ui.month);

    document.querySelectorAll('[data-filter]').forEach(function (b) {
      var active = b.getAttribute('data-filter') === ui.filter;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    var income = C.sumByType(monthTx, 'income');
    var expenses = C.sumByType(monthTx, 'expense');
    $('tx-totals').innerHTML =
      '<span>Einnahmen <strong class="is-income">' + C.formatEuro(income) + '</strong></span>' +
      '<span>Ausgaben <strong class="is-expense">' + C.formatEuro(expenses) + '</strong></span>' +
      '<span>Saldo <strong>' + signedEuro(income - expenses) + '</strong></span>';

    $('tx-list').innerHTML = filtered.length
      ? filtered.map(function (t) { return txItem(t, true); }).join('')
      : '<li class="empty">Keine passenden Buchungen in diesem Monat.</li>';

    var dateInput = $('tx-date');
    if (!dateInput.value || C.monthKeyOf(dateInput.value) !== ui.month) dateInput.value = defaultDateForMonth();
  }

  function onSubmitTransaction(event) {
    event.preventDefault();
    var form = event.target;
    var type = form.type.value;
    var amount = C.parseAmount(form.amount.value);
    var date = form.date.value;
    var error = $('tx-error');

    if (amount === null) { error.textContent = 'Bitte gib einen gültigen Betrag größer als 0 ein, z. B. 12,50.'; form.amount.focus(); return; }
    if (amount > 100000000) { error.textContent = 'Der Betrag ist zu groß (maximal 1.000.000 €).'; form.amount.focus(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { error.textContent = 'Bitte wähle ein Datum.'; form.date.focus(); return; }
    error.textContent = '';

    state.transactions.push({
      id: S.createId(),
      type: type,
      amount: amount,
      category: form.category.value,
      description: form.description.value.trim(),
      date: date,
      sample: false
    });

    form.amount.value = '';
    form.description.value = '';
    var txMonth = C.monthKeyOf(date);
    if (txMonth !== ui.month) ui.month = txMonth;
    persist();
    toast((type === 'income' ? 'Einnahme' : 'Ausgabe') + ' über ' + C.formatEuro(amount) + ' gespeichert.');
    form.amount.focus();
  }

  function deleteTransaction(id) {
    var tx = state.transactions.filter(function (t) { return t.id === id; })[0];
    if (!tx) return;
    var label = (tx.description || tx.category) + ' (' + C.formatEuro(tx.amount) + ')';
    if (!window.confirm('Buchung „' + label + '“ wirklich löschen?')) return;
    state.transactions = state.transactions.filter(function (t) { return t.id !== id; });
    persist();
    toast('Buchung gelöscht.');
  }

  /* ---------- Budget ---------- */

  function onSubmitBudget(event) {
    event.preventDefault();
    var amount = C.parseAmount($('budget-input').value);
    var error = $('budget-error');
    if (amount === null) { error.textContent = 'Bitte gib ein gültiges Budget größer als 0 ein.'; return; }
    error.textContent = '';
    if (state.sampleBudget) { state.budgets = {}; state.sampleBudget = false; }
    state.budgets[ui.month] = amount;
    $('budget-input').blur();
    persist();
    toast('Budget für ' + C.monthLabel(ui.month) + ' gespeichert.');
  }

  /* ---------- Sparziele ---------- */

  function renderGoals() {
    var today = S.todayString();
    $('goal-list').innerHTML = state.goals.length
      ? state.goals.map(function (g) {
          var p = C.goalProgress(g, today);
          var details = [];
          if (p.reached) details.push('🎉 Ziel erreicht – herzlichen Glückwunsch!');
          else details.push('Noch <strong>' + C.formatEuro(p.remaining) + '</strong> bis zum Ziel.');
          if (g.deadline && !p.reached) {
            details.push(p.monthsLeft > 0
              ? 'Bis ' + C.formatDate(g.deadline) + ': etwa <strong>' + C.formatEuro(p.perMonth) + '</strong> pro Monat sparen.'
              : '⚠ Das Zieldatum ' + C.formatDate(g.deadline) + ' ist bereits vorbei.');
          }
          return '<article class="card goal' + (p.reached ? ' goal-reached' : '') + '">' +
            '<div class="card-head">' +
              '<h3>' + escapeHtml(g.name) + ' ' + sampleBadge(g) + '</h3>' +
              '<button type="button" class="icon-btn icon-btn-small" data-action="delete-goal" data-id="' + g.id +
                '" aria-label="Sparziel löschen" title="Löschen">✕</button>' +
            '</div>' +
            '<div class="goal-amounts"><span class="goal-saved">' + C.formatEuro(p.saved) + '</span>' +
              '<span class="muted">von ' + C.formatEuro(g.target) + '</span></div>' +
            '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p.percent +
              '" aria-label="Fortschritt ' + escapeHtml(g.name) + '"><span style="width:' + p.percent + '%"></span></div>' +
            '<p class="goal-percent">' + p.percent + ' % erreicht</p>' +
            '<p class="muted">' + details.join('<br>') + '</p>' +
            '<form class="deposit-form" data-id="' + g.id + '" novalidate>' +
              '<label class="sr-only" for="dep-' + g.id + '">Betrag für ' + escapeHtml(g.name) + '</label>' +
              '<div class="input-euro"><input id="dep-' + g.id + '" name="amount" type="text" inputmode="decimal" placeholder="Betrag" autocomplete="off"><span aria-hidden="true">€</span></div>' +
              '<button type="submit" class="btn btn-primary btn-small" data-mode="deposit">Einzahlen</button>' +
              '<button type="submit" class="btn btn-ghost btn-small" data-mode="withdraw">Entnehmen</button>' +
            '</form>' +
            '<p class="form-error" role="alert"></p>' +
            '</article>';
        }).join('')
      : '<article class="card"><p class="empty">Du hast noch keine Sparziele. Lege links dein erstes Ziel an – zum Beispiel einen Notgroschen.</p></article>';
  }

  function onSubmitGoal(event) {
    event.preventDefault();
    var form = event.target;
    var name = form.name.value.trim();
    var target = C.parseAmount(form.target.value);
    var savedText = form.saved.value.trim();
    var saved = savedText === '' || savedText === '0' ? 0 : C.parseAmount(savedText);
    var error = $('goal-error');

    if (!name) { error.textContent = 'Bitte gib dem Sparziel einen Namen.'; form.name.focus(); return; }
    if (target === null) { error.textContent = 'Bitte gib einen gültigen Zielbetrag ein.'; form.target.focus(); return; }
    if (saved === null) { error.textContent = 'Der bereits gesparte Betrag ist ungültig.'; form.saved.focus(); return; }
    error.textContent = '';

    state.goals.push({ id: S.createId(), name: name, target: target, saved: saved, deadline: form.deadline.value || '', sample: false });
    form.reset();
    persist();
    toast('Sparziel „' + name + '“ angelegt.');
  }

  function onSubmitDeposit(event) {
    event.preventDefault();
    var form = event.target;
    var goal = state.goals.filter(function (g) { return g.id === form.getAttribute('data-id'); })[0];
    if (!goal) return;
    var mode = event.submitter ? event.submitter.getAttribute('data-mode') : 'deposit';
    var amount = C.parseAmount(form.amount.value);
    var error = form.nextElementSibling;

    if (amount === null) { error.textContent = 'Bitte gib einen gültigen Betrag ein.'; return; }
    if (mode === 'withdraw' && amount > goal.saved) {
      error.textContent = 'Du kannst höchstens ' + C.formatEuro(goal.saved) + ' entnehmen.';
      return;
    }
    goal.saved += mode === 'withdraw' ? -amount : amount;
    persist();
    toast(mode === 'withdraw'
      ? C.formatEuro(amount) + ' aus „' + goal.name + '“ entnommen.'
      : C.formatEuro(amount) + ' für „' + goal.name + '“ gespart.');
  }

  function deleteGoal(id) {
    var goal = state.goals.filter(function (g) { return g.id === id; })[0];
    if (!goal || !window.confirm('Sparziel „' + goal.name + '“ wirklich löschen?')) return;
    state.goals = state.goals.filter(function (g) { return g.id !== id; });
    persist();
    toast('Sparziel gelöscht.');
  }

  /* ---------- Statistik ---------- */

  function changeCell(current, previous, higherIsGood) {
    var diff = current - previous;
    if (diff === 0) return '<td class="num muted">±0 €</td>';
    var pct = C.percentChange(current, previous);
    var good = higherIsGood ? diff > 0 : diff < 0;
    return '<td class="num ' + (good ? 'trend-good' : 'trend-bad') + '">' +
      (diff > 0 ? '▲ ' : '▼ ') + signedEuro(diff) + (pct === null ? ' (neu)' : ' (' + (pct > 0 ? '+' : '') + pct + ' %)') + '</td>';
  }

  function renderStatistics() {
    var prevKey = C.shiftMonth(ui.month, -1);
    var current = C.monthSummary(state.transactions, state.budgets, ui.month);
    var previous = C.monthSummary(state.transactions, state.budgets, prevKey);
    var series = C.monthlySeries(state.transactions, ui.month, 6);
    var monthTx = C.transactionsForMonth(state.transactions, ui.month);
    var categories = C.expensesByCategory(monthTx);
    var biggest = C.largestExpense(monthTx);
    var rate = C.savingsRate(current.income, current.expenses);
    var avg = C.averageMonthlyExpenses(series);

    $('stat-kpis').innerHTML =
      kpiCard('Sparquote', rate === null ? '–' : rate + ' %', rate === null ? 'Keine Einnahmen in diesem Monat' : 'Anteil der Einnahmen, der übrig bleibt') +
      kpiCard('Ø Ausgaben pro Monat', avg === null ? '–' : C.formatEuro(avg), 'Durchschnitt der letzten 6 Monate') +
      kpiCard('Größte Kategorie', categories.length ? escapeHtml(categories[0].category) : '–',
        categories.length ? C.formatEuro(categories[0].amount) + ' in diesem Monat' : 'Keine Ausgaben') +
      kpiCard('Größte Einzelausgabe', biggest ? C.formatEuro(biggest.amount) : '–',
        biggest ? escapeHtml(biggest.description || biggest.category) + ' · ' + C.formatDate(biggest.date) : 'Keine Ausgaben');

    Charts.incomeExpenseBars($('bar-chart'), series);
    $('bar-table').innerHTML = '<table><thead><tr><th>Monat</th><th class="num">Einnahmen</th><th class="num">Ausgaben</th><th class="num">Saldo</th></tr></thead><tbody>' +
      series.map(function (m) {
        return '<tr><td>' + C.monthLabel(m.key) + '</td><td class="num">' + C.formatEuro(m.income) + '</td><td class="num">' +
          C.formatEuro(m.expenses) + '</td><td class="num">' + signedEuro(m.income - m.expenses) + '</td></tr>';
      }).join('') + '</tbody></table>';

    $('compare-title').textContent = 'Vergleich: ' + C.monthLabel(ui.month) + ' und ' + C.monthLabel(prevKey);
    var rows = C.compareCategories(state.transactions, ui.month, prevKey);
    $('compare-table').innerHTML =
      '<table><thead><tr><th></th><th class="num">' + C.monthLabel(prevKey) + '</th><th class="num">' + C.monthLabel(ui.month) +
      '</th><th class="num">Veränderung</th></tr></thead><tbody>' +
      '<tr class="row-strong"><td>Einnahmen</td><td class="num">' + C.formatEuro(previous.income) + '</td><td class="num">' +
        C.formatEuro(current.income) + '</td>' + changeCell(current.income, previous.income, true) + '</tr>' +
      '<tr class="row-strong"><td>Ausgaben</td><td class="num">' + C.formatEuro(previous.expenses) + '</td><td class="num">' +
        C.formatEuro(current.expenses) + '</td>' + changeCell(current.expenses, previous.expenses, false) + '</tr>' +
      '<tr class="row-strong row-sep"><td>Saldo</td><td class="num">' + signedEuro(previous.balance) + '</td><td class="num">' +
        signedEuro(current.balance) + '</td>' + changeCell(current.balance, previous.balance, true) + '</tr>' +
      (rows.length ? rows.map(function (r) {
        return '<tr><td><span class="swatch" style="background:' + categoryInfo('expense', r.category).color + '"></span>' +
          escapeHtml(r.category) + '</td><td class="num">' + C.formatEuro(r.previous) + '</td><td class="num">' +
          C.formatEuro(r.current) + '</td>' + changeCell(r.current, r.previous, false) + '</tr>';
      }).join('') : '<tr><td colspan="4" class="empty">Keine Ausgaben in diesen beiden Monaten.</td></tr>') +
      '</tbody></table>' +
      '<p class="muted small">▲/▼ zeigt die Veränderung zum Vormonat. Grün bedeutet: Entwicklung in die gewünschte Richtung.</p>';
  }

  /* ---------- Spartipps ---------- */

  var TIPS = [
    { icon: '📊', title: 'Die 50-30-20-Regel', text: 'Teile dein Nettoeinkommen grob auf: 50 % für Fixkosten, 30 % für Wünsche und 20 % zum Sparen.' },
    { icon: '🏦', title: 'Zuerst dich selbst bezahlen', text: 'Richte zum Gehaltseingang einen Dauerauftrag auf dein Sparkonto ein. Was weg ist, wird nicht ausgegeben.' },
    { icon: '🛟', title: 'Notgroschen aufbauen', text: 'Drei bis sechs Monatsausgaben als Reserve schützen dich vor teuren Krediten bei unerwarteten Kosten.' },
    { icon: '🛒', title: 'Mit Einkaufsliste einkaufen', text: 'Plane deine Mahlzeiten für die Woche und kaufe nur, was auf der Liste steht. Nie hungrig einkaufen!' },
    { icon: '📱', title: 'Abos überprüfen', text: 'Streaming, Apps, Fitnessstudio: Kündige alles, was du im letzten Monat nicht genutzt hast.' },
    { icon: '⚡', title: 'Verträge vergleichen', text: 'Strom, Gas, Handy und Versicherungen lohnen sich jährlich zu vergleichen. Ein Wechsel spart oft viel Geld.' },
    { icon: '⏳', title: 'Die 72-Stunden-Regel', text: 'Warte bei spontanen Käufen drei Tage. Willst du es dann immer noch, ist es wohl ein echter Wunsch.' },
    { icon: '💶', title: 'Bargeld für Freizeit', text: 'Hebe dein Freizeitbudget bar ab. Wenn das Portemonnaie leer ist, siehst du sofort, dass Schluss ist.' },
    { icon: '🎯', title: 'Konkrete Sparziele', text: 'Ein Ziel mit Betrag und Datum motiviert mehr als „irgendwann sparen“. Nutze dafür die Sparziele in MoneyPilot.' }
  ];

  function renderTips() {
    $('tips').innerHTML = TIPS.map(function (t) {
      return '<article class="card tip"><span class="tip-icon" aria-hidden="true">' + t.icon + '</span>' +
        '<h3>' + t.title + '</h3><p>' + t.text + '</p></article>';
    }).join('');

    // Persönlicher Hinweis auf Basis des aktuellen Monats
    var key = C.monthKeyOf(S.todayString());
    var summary = C.monthSummary(state.transactions, state.budgets, key);
    var top = C.expensesByCategory(C.transactionsForMonth(state.transactions, key))[0];
    var hints = [];
    if (summary.budget !== null && summary.budgetRemaining < 0) {
      hints.push('Du hast dein Budget in diesem Monat um ' + C.formatEuro(-summary.budgetRemaining) + ' überschritten. Prüfe, welche Ausgaben du verschieben kannst.');
    } else if (summary.budget !== null) {
      hints.push('Du hast in diesem Monat noch ' + C.formatEuro(summary.budgetRemaining) + ' Budget übrig. Was übrig bleibt, kannst du in ein Sparziel einzahlen.');
    }
    if (top) hints.push('Deine größte Ausgabenkategorie in diesem Monat ist <strong>' + escapeHtml(top.category) + '</strong> mit ' + C.formatEuro(top.amount) + '.');
    $('personal-tip').innerHTML = hints.length
      ? '<article class="card card-highlight"><h3>Dein persönlicher Hinweis</h3><p>' + hints.join(' ') + '</p></article>'
      : '';
  }

  /* ---------- Daten verwalten ---------- */

  function removeSamples() {
    if (!window.confirm('Alle Beispieldaten entfernen? Deine eigenen Einträge bleiben erhalten.')) return;
    state.transactions = state.transactions.filter(function (t) { return !t.sample; });
    state.goals = state.goals.filter(function (g) { return !g.sample; });
    if (state.sampleBudget) { state.budgets = {}; state.sampleBudget = false; }
    persist();
    toast('Beispieldaten entfernt.');
  }

  function loadSamples() {
    var sample = S.createSampleData(S.todayString());
    state.transactions = state.transactions.filter(function (t) { return !t.sample; }).concat(sample.transactions);
    state.goals = state.goals.filter(function (g) { return !g.sample; }).concat(sample.goals);
    if (!Object.keys(state.budgets).length || state.sampleBudget) {
      state.budgets = sample.budgets;
      state.sampleBudget = true;
    }
    ui.month = C.monthKeyOf(S.todayString());
    persist();
    toast('Beispieldaten geladen.');
  }

  function resetAll() {
    if (!window.confirm('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.')) return;
    state = S.emptyState();
    persist();
    toast('Alle Daten gelöscht.');
  }

  /* ---------- Rendern & Ereignisse ---------- */

  function render() {
    Charts.hideTip();
    renderNavigation();
    if (ui.page === 'uebersicht') renderOverview();
    if (ui.page === 'buchungen') renderTransactions();
    if (ui.page === 'sparziele') renderGoals();
    if (ui.page === 'statistik') renderStatistics();
    if (ui.page === 'spartipps') renderTips();
  }

  document.addEventListener('click', function (event) {
    var target = event.target.closest('[data-action], [data-filter]');
    if (!target) return;
    var action = target.getAttribute('data-action');
    if (target.hasAttribute('data-filter')) { ui.filter = target.getAttribute('data-filter'); render(); return; }
    if (action === 'prev-month') { ui.month = C.shiftMonth(ui.month, -1); render(); }
    if (action === 'next-month') { ui.month = C.shiftMonth(ui.month, 1); render(); }
    if (action === 'this-month') { ui.month = C.monthKeyOf(S.todayString()); render(); }
    if (action === 'delete-tx') deleteTransaction(target.getAttribute('data-id'));
    if (action === 'delete-goal') deleteGoal(target.getAttribute('data-id'));
    if (action === 'remove-samples') removeSamples();
    if (action === 'load-samples') loadSamples();
    if (action === 'reset-all') resetAll();
  });

  document.addEventListener('submit', function (event) {
    if (event.target.classList.contains('deposit-form')) onSubmitDeposit(event);
  });

  $('tx-form').addEventListener('submit', onSubmitTransaction);
  $('goal-form').addEventListener('submit', onSubmitGoal);
  $('budget-form').addEventListener('submit', onSubmitBudget);
  document.querySelectorAll('input[name="type"]').forEach(function (r) { r.addEventListener('change', fillCategorySelect); });

  window.addEventListener('hashchange', function () { readPageFromHash(); render(); window.scrollTo(0, 0); });

  readPageFromHash();
  fillCategorySelect();
  render();
})();
