/*
 * MoneyPilot – Berechnungen
 *
 * Hier stecken alle Rechenfunktionen der App. Sie verändern keine Daten und
 * greifen nicht auf den Browser zu – dadurch lassen sie sich einfach testen
 * (siehe tests/calculations.test.js).
 *
 * Wichtig: Alle Geldbeträge werden intern in CENT als ganze Zahl gespeichert
 * (z. B. 12,50 € = 1250). So entstehen keine Rundungsfehler wie 0,1 + 0,2.
 */
(function (global) {
  'use strict';

  var MONTH_NAMES = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  var euroFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

  /** Cent-Betrag als Euro-Text, z. B. 123456 -> "1.234,56 €" */
  function formatEuro(cents) {
    return euroFormatter.format((cents || 0) / 100);
  }

  /**
   * Liest eine Benutzereingabe wie "1.234,56", "12,5", "12.50" oder "1500 €"
   * und gibt den Betrag in Cent zurück. Ungültige oder nicht positive Werte -> null.
   */
  function parseAmount(input) {
    if (input === null || input === undefined) return null;
    var text = String(input).replace(/[€\s]/g, '');
    if (text === '') return null;

    if (text.indexOf(',') !== -1) {
      // Deutsches Format: Punkte sind Tausendertrennzeichen, Komma ist Dezimaltrenner
      text = text.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
      // "1.500" bedeutet im Deutschen 1500
      text = text.replace(/\./g, '');
    }

    if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
    var cents = Math.round(parseFloat(text) * 100);
    return cents > 0 ? cents : null;
  }

  /** "2026-10-28" -> "2026-10" */
  function monthKeyOf(dateStr) {
    return String(dateStr).slice(0, 7);
  }

  /** Monat verschieben: shiftMonth("2026-01", -1) -> "2025-12" */
  function shiftMonth(key, delta) {
    var parts = key.split('-');
    var index = Number(parts[0]) * 12 + (Number(parts[1]) - 1) + delta;
    var year = Math.floor(index / 12);
    var month = (index % 12) + 1;
    return year + '-' + (month < 10 ? '0' : '') + month;
  }

  /** "2026-10" -> "Oktober 2026" */
  function monthLabel(key) {
    var parts = key.split('-');
    return MONTH_NAMES[Number(parts[1]) - 1] + ' ' + parts[0];
  }

  /** "2026-10" -> "Okt." (kurz, für Diagrammachsen) */
  function monthShortLabel(key) {
    var name = MONTH_NAMES[Number(key.split('-')[1]) - 1];
    return name.length > 4 ? name.slice(0, 3) + '.' : name;
  }

  /** Datum als "TT.MM.JJJJ" */
  function formatDate(dateStr) {
    var p = String(dateStr).split('-');
    return p[2] + '.' + p[1] + '.' + p[0];
  }

  function transactionsForMonth(transactions, key) {
    return transactions.filter(function (t) { return monthKeyOf(t.date) === key; });
  }

  function sumByType(transactions, type) {
    return transactions.reduce(function (sum, t) {
      return t.type === type ? sum + t.amount : sum;
    }, 0);
  }

  /**
   * Budget für einen Monat. Ist für diesen Monat kein eigenes Budget gesetzt,
   * gilt das zuletzt festgelegte Budget eines früheren Monats weiter.
   * Gibt null zurück, wenn noch nie ein Budget festgelegt wurde.
   */
  function budgetForMonth(budgets, key) {
    if (budgets[key] !== undefined) return budgets[key];
    var earlier = Object.keys(budgets).filter(function (k) { return k < key; }).sort();
    return earlier.length ? budgets[earlier[earlier.length - 1]] : null;
  }

  /** Die wichtigsten Kennzahlen eines Monats. */
  function monthSummary(transactions, budgets, key) {
    var monthTx = transactionsForMonth(transactions, key);
    var income = sumByType(monthTx, 'income');
    var expenses = sumByType(monthTx, 'expense');
    var budget = budgetForMonth(budgets, key);
    return {
      income: income,
      expenses: expenses,
      balance: income - expenses,
      budget: budget,
      budgetRemaining: budget === null ? null : budget - expenses,
      budgetUsedPercent: budget ? Math.round((expenses / budget) * 100) : null,
      count: monthTx.length
    };
  }

  /** Ausgaben nach Kategorie, größte zuerst: [{ category, amount }] */
  function expensesByCategory(transactions) {
    var totals = {};
    transactions.forEach(function (t) {
      if (t.type !== 'expense') return;
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });
    return Object.keys(totals)
      .map(function (c) { return { category: c, amount: totals[c] }; })
      .sort(function (a, b) { return b.amount - a.amount; });
  }

  /** Einnahmen und Ausgaben der letzten `count` Monate bis einschließlich endKey. */
  function monthlySeries(transactions, endKey, count) {
    var result = [];
    for (var i = count - 1; i >= 0; i--) {
      var key = shiftMonth(endKey, -i);
      var monthTx = transactionsForMonth(transactions, key);
      result.push({
        key: key,
        income: sumByType(monthTx, 'income'),
        expenses: sumByType(monthTx, 'expense')
      });
    }
    return result;
  }

  /** Sparquote in Prozent: Anteil der Einnahmen, der übrig bleibt. */
  function savingsRate(income, expenses) {
    if (!income) return null;
    return Math.round(((income - expenses) / income) * 100);
  }

  /** Veränderung in Prozent von `previous` zu `current` (null, wenn nicht berechenbar). */
  function percentChange(current, previous) {
    if (!previous) return null;
    return Math.round(((current - previous) / previous) * 100);
  }

  /** Vergleich zweier Monate je Ausgabenkategorie. */
  function compareCategories(transactions, currentKey, previousKey) {
    var current = expensesByCategory(transactionsForMonth(transactions, currentKey));
    var previous = expensesByCategory(transactionsForMonth(transactions, previousKey));
    var map = {};
    current.forEach(function (c) { map[c.category] = { category: c.category, current: c.amount, previous: 0 }; });
    previous.forEach(function (c) {
      if (!map[c.category]) map[c.category] = { category: c.category, current: 0, previous: 0 };
      map[c.category].previous = c.amount;
    });
    return Object.keys(map).map(function (k) {
      var row = map[k];
      row.difference = row.current - row.previous;
      row.change = percentChange(row.current, row.previous);
      return row;
    }).sort(function (a, b) { return b.current - a.current; });
  }

  /** Durchschnittliche Ausgaben über alle Monate der Reihe, die Buchungen haben. */
  function averageMonthlyExpenses(series) {
    var active = series.filter(function (m) { return m.income > 0 || m.expenses > 0; });
    if (!active.length) return null;
    var total = active.reduce(function (s, m) { return s + m.expenses; }, 0);
    return Math.round(total / active.length);
  }

  /** Größte einzelne Ausgabe einer Liste (oder null). */
  function largestExpense(transactions) {
    return transactions.reduce(function (max, t) {
      if (t.type !== 'expense') return max;
      return !max || t.amount > max.amount ? t : max;
    }, null);
  }

  /** Fortschritt eines Sparziels. */
  function goalProgress(goal, todayStr) {
    var saved = Math.max(0, goal.saved || 0);
    var remaining = Math.max(0, goal.target - saved);
    var percent = goal.target > 0 ? Math.min(100, Math.floor((saved / goal.target) * 100)) : 0;
    var monthsLeft = null;
    var perMonth = null;
    if (goal.deadline && todayStr && remaining > 0) {
      var t = todayStr.split('-').map(Number);
      var d = goal.deadline.split('-').map(Number);
      monthsLeft = (d[0] - t[0]) * 12 + (d[1] - t[1]);
      // Der laufende Monat zählt mit, solange das Zieldatum nicht vorbei ist
      if (goal.deadline >= todayStr) monthsLeft = Math.max(1, monthsLeft + 1);
      else monthsLeft = 0;
      perMonth = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : null;
    }
    return {
      saved: saved,
      remaining: remaining,
      percent: percent,
      reached: saved >= goal.target,
      monthsLeft: monthsLeft,
      perMonth: perMonth
    };
  }

  var api = {
    MONTH_NAMES: MONTH_NAMES,
    formatEuro: formatEuro,
    parseAmount: parseAmount,
    monthKeyOf: monthKeyOf,
    shiftMonth: shiftMonth,
    monthLabel: monthLabel,
    monthShortLabel: monthShortLabel,
    formatDate: formatDate,
    transactionsForMonth: transactionsForMonth,
    sumByType: sumByType,
    budgetForMonth: budgetForMonth,
    monthSummary: monthSummary,
    expensesByCategory: expensesByCategory,
    monthlySeries: monthlySeries,
    savingsRate: savingsRate,
    percentChange: percentChange,
    compareCategories: compareCategories,
    averageMonthlyExpenses: averageMonthlyExpenses,
    largestExpense: largestExpense,
    goalProgress: goalProgress
  };

  // Im Browser als window.MPCalc verfügbar, in Node.js (Tests) per require()
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.MPCalc = api;
})(this);
