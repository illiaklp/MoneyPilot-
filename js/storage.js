/*
 * MoneyPilot – Speicherung und Beispieldaten
 *
 * Alle Daten werden nur im eigenen Browser gespeichert (localStorage).
 * Es werden keine Daten an einen Server oder an Dritte geschickt.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'moneypilot.v1';

  /** Kategorien für Einnahmen und Ausgaben. Die Farbe gehört fest zur Kategorie. */
  var CATEGORIES = {
    income: [
      { id: 'Gehalt', icon: '💼' },
      { id: 'Nebenjob', icon: '🧾' },
      { id: 'Sonstiges', icon: '✨' }
    ],
    expense: [
      { id: 'Wohnen', icon: '🏠', color: '#2a78d6' },
      { id: 'Lebensmittel', icon: '🛒', color: '#eb6834' },
      { id: 'Mobilität', icon: '🚆', color: '#1baf7a' },
      { id: 'Freizeit', icon: '🎬', color: '#eda100' },
      { id: 'Gesundheit', icon: '🩺', color: '#e87ba4' },
      { id: 'Sonstiges', icon: '📦', color: '#6250d6' }
    ]
  };

  function todayString() {
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function createId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function emptyState() {
    return { transactions: [], budgets: {}, goals: [] };
  }

  /**
   * Erzeugt Beispieldaten für den aktuellen und die drei vorherigen Monate.
   * Jeder Eintrag ist mit sample: true markiert und wird in der App als
   * "Beispiel" gekennzeichnet.
   */
  function createSampleData(todayStr) {
    var C = global.MPCalc;
    var currentKey = C.monthKeyOf(todayStr);
    var todayDay = Number(todayStr.slice(8, 10));
    var transactions = [];

    // Leichte Unterschiede pro Monat, damit Vergleiche etwas zeigen
    var variations = [
      { food: [8640, 6215, 9380, 4790], fun: [4500, 3290], extra: 0, health: 0, misc: 3999 },
      { food: [7920, 5470, 8815, 6230], fun: [12900, 2450], extra: 32000, health: 2450, misc: 0 },
      { food: [9110, 6840, 7360, 5525], fun: [6800, 1990, 3400], extra: 0, health: 0, misc: 12999 },
      { food: [8230, 5990, 7745, 6120], fun: [5490, 2800], extra: 28000, health: 1890, misc: 2499 }
    ];

    for (var i = 3; i >= 0; i--) {
      var key = C.shiftMonth(currentKey, -i);
      var v = variations[i];
      var isCurrent = i === 0;

      var add = function (type, amount, category, description, day) {
        // Im laufenden Monat nur Buchungen bis heute anlegen
        if (isCurrent && day > todayDay) return;
        transactions.push({
          id: createId(),
          type: type,
          amount: amount,
          category: category,
          description: description,
          date: key + '-' + (day < 10 ? '0' : '') + day,
          sample: true
        });
      };

      add('income', 285000, 'Gehalt', 'Gehalt (Beispiel GmbH)', 1);
      if (v.extra) add('income', v.extra, 'Nebenjob', 'Nachhilfe', 15);
      add('expense', 95000, 'Wohnen', 'Miete', 1);
      add('expense', 7500, 'Wohnen', 'Strom', 3);
      add('expense', 5800, 'Mobilität', 'Deutschlandticket', 2);
      add('expense', 3999, 'Sonstiges', 'Handyvertrag', 5);
      v.food.forEach(function (amount, n) { add('expense', amount, 'Lebensmittel', 'Wocheneinkauf', 4 + n * 7); });
      v.fun.forEach(function (amount, n) {
        add('expense', amount, 'Freizeit', ['Restaurant', 'Kino', 'Konzert'][n], 9 + n * 6);
      });
      if (v.health) add('expense', v.health, 'Gesundheit', 'Apotheke', 18);
      if (v.misc) add('expense', v.misc, 'Sonstiges', 'Geschenk', 22);
    }

    var budgets = {};
    budgets[C.shiftMonth(currentKey, -3)] = 180000; // 1.800 € gilt für alle folgenden Monate

    var goals = [
      { id: createId(), name: 'Notgroschen', target: 500000, saved: 210000, deadline: '', sample: true },
      { id: createId(), name: 'Urlaub in Portugal', target: 150000, saved: 64000,
        deadline: C.shiftMonth(currentKey, 8) + '-01', sample: true }
    ];

    return { transactions: transactions, budgets: budgets, goals: goals, sampleBudget: true };
  }

  /** Lädt die gespeicherten Daten. Beim allerersten Start werden Beispieldaten angelegt. */
  function load() {
    var raw = null;
    try { raw = global.localStorage.getItem(STORAGE_KEY); } catch (e) { /* z. B. privater Modus */ }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        return {
          transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
          budgets: parsed.budgets && typeof parsed.budgets === 'object' ? parsed.budgets : {},
          goals: Array.isArray(parsed.goals) ? parsed.goals : [],
          sampleBudget: !!parsed.sampleBudget
        };
      } catch (e) {
        console.warn('Gespeicherte Daten konnten nicht gelesen werden – starte neu.', e);
      }
    }
    var fresh = createSampleData(todayString());
    save(fresh);
    return fresh;
  }

  function save(state) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('Daten konnten nicht gespeichert werden.', e);
      return false;
    }
  }

  global.MPStorage = {
    CATEGORIES: CATEGORIES,
    todayString: todayString,
    createId: createId,
    emptyState: emptyState,
    createSampleData: createSampleData,
    load: load,
    save: save
  };
})(this);
