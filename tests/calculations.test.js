/*
 * Tests für die Berechnungen von MoneyPilot.
 * Starten mit:  node tests/calculations.test.js   (oder: npm test)
 */
const assert = require('node:assert/strict');
const C = require('../js/calculations.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

const tx = (type, amount, category, date) => ({ id: date + amount, type, amount, category, date });
const data = [
  tx('income', 285000, 'Gehalt', '2026-10-01'),
  tx('expense', 95000, 'Wohnen', '2026-10-01'),
  tx('expense', 1250, 'Lebensmittel', '2026-10-03'),
  tx('expense', 4890, 'Lebensmittel', '2026-10-10'),
  tx('income', 280000, 'Gehalt', '2026-09-01'),
  tx('expense', 95000, 'Wohnen', '2026-09-01'),
  tx('expense', 10000, 'Freizeit', '2026-09-12')
];

console.log('Beträge');
test('deutsche Eingaben werden korrekt in Cent umgerechnet', () => {
  assert.equal(C.parseAmount('12,50'), 1250);
  assert.equal(C.parseAmount('1.234,56'), 123456);
  assert.equal(C.parseAmount('1.500'), 150000);
  assert.equal(C.parseAmount('12.5'), 1250);
  assert.equal(C.parseAmount(' 99 € '), 9900);
  assert.equal(C.parseAmount('0,1'), 10);
});
test('ungültige Eingaben werden abgelehnt', () => {
  for (const v of ['', 'abc', '0', '-5', '1,234', '12,3,4', null]) assert.equal(C.parseAmount(v), null, String(v));
});
test('keine Rundungsfehler bei Summen (0,10 € + 0,20 €)', () => {
  const sum = C.sumByType([tx('expense', C.parseAmount('0,10'), 'X', '2026-01-01'), tx('expense', C.parseAmount('0,20'), 'X', '2026-01-02')], 'expense');
  assert.equal(sum, 30);
});
test('Euro-Formatierung', () => {
  assert.equal(C.formatEuro(123456).replace(/\s/g, ' '), '1.234,56 €');
});

console.log('Monate');
test('Monate verschieben über Jahresgrenzen', () => {
  assert.equal(C.shiftMonth('2026-01', -1), '2025-12');
  assert.equal(C.shiftMonth('2025-12', 1), '2026-01');
  assert.equal(C.shiftMonth('2026-10', -12), '2025-10');
});
test('Monatsnamen auf Deutsch', () => {
  assert.equal(C.monthLabel('2026-03'), 'März 2026');
});

console.log('Monatsübersicht & Budget');
test('Einnahmen, Ausgaben und Saldo eines Monats', () => {
  const s = C.monthSummary(data, {}, '2026-10');
  assert.equal(s.income, 285000);
  assert.equal(s.expenses, 101140);
  assert.equal(s.balance, 183860);
  assert.equal(s.budget, null);
  assert.equal(s.budgetRemaining, null);
});
test('verbleibendes Budget = Budget − Ausgaben', () => {
  const s = C.monthSummary(data, { '2026-10': 120000 }, '2026-10');
  assert.equal(s.budgetRemaining, 18860);
  assert.equal(s.budgetUsedPercent, 84);
});
test('Budgetüberschreitung ergibt negativen Restbetrag', () => {
  const s = C.monthSummary(data, { '2026-10': 100000 }, '2026-10');
  assert.equal(s.budgetRemaining, -1140);
});
test('Budget gilt in Folgemonaten weiter, aber nicht rückwirkend', () => {
  const budgets = { '2026-08': 150000, '2026-10': 120000 };
  assert.equal(C.budgetForMonth(budgets, '2026-09'), 150000);
  assert.equal(C.budgetForMonth(budgets, '2026-12'), 120000);
  assert.equal(C.budgetForMonth(budgets, '2026-07'), null);
});

console.log('Statistik');
test('Ausgaben nach Kategorie, absteigend', () => {
  const c = C.expensesByCategory(C.transactionsForMonth(data, '2026-10'));
  assert.deepEqual(c, [{ category: 'Wohnen', amount: 95000 }, { category: 'Lebensmittel', amount: 6140 }]);
});
test('Monatsreihe für das Diagramm', () => {
  const s = C.monthlySeries(data, '2026-10', 3);
  assert.deepEqual(s.map(m => m.key), ['2026-08', '2026-09', '2026-10']);
  assert.equal(s[0].income, 0);
  assert.equal(s[1].expenses, 105000);
});
test('Sparquote und Veränderung in Prozent', () => {
  assert.equal(C.savingsRate(200000, 150000), 25);
  assert.equal(C.savingsRate(0, 1000), null);
  assert.equal(C.percentChange(110, 100), 10);
  assert.equal(C.percentChange(100, 0), null);
});
test('Monatsvergleich je Kategorie', () => {
  const rows = C.compareCategories(data, '2026-10', '2026-09');
  const freizeit = rows.find(r => r.category === 'Freizeit');
  assert.deepEqual([freizeit.current, freizeit.previous, freizeit.change], [0, 10000, -100]);
  const food = rows.find(r => r.category === 'Lebensmittel');
  assert.equal(food.change, null);
});
test('Durchschnitt zählt nur Monate mit Buchungen', () => {
  assert.equal(C.averageMonthlyExpenses(C.monthlySeries(data, '2026-10', 6)), 103070);
});
test('größte Einzelausgabe', () => {
  assert.equal(C.largestExpense(data).amount, 95000);
  assert.equal(C.largestExpense([]), null);
});

console.log('Sparziele');
test('Fortschritt und Restbetrag', () => {
  const p = C.goalProgress({ target: 150000, saved: 64000 }, '2026-10-28');
  assert.equal(p.percent, 42);
  assert.equal(p.remaining, 86000);
  assert.equal(p.reached, false);
});
test('Fortschritt wird bei 100 % gedeckelt', () => {
  const p = C.goalProgress({ target: 1000, saved: 1500 }, '2026-10-28');
  assert.equal(p.percent, 100);
  assert.equal(p.remaining, 0);
  assert.equal(p.reached, true);
});
test('monatliche Sparrate bis zum Zieldatum', () => {
  // Okt, Nov, Dez = 3 Monate
  const p = C.goalProgress({ target: 30000, saved: 0, deadline: '2026-12-31' }, '2026-10-28');
  assert.equal(p.monthsLeft, 3);
  assert.equal(p.perMonth, 10000);
  const late = C.goalProgress({ target: 30000, saved: 0, deadline: '2026-01-01' }, '2026-10-28');
  assert.equal(late.monthsLeft, 0);
});

console.log('\n' + passed + ' Tests bestanden' + (process.exitCode ? ' – es gibt FEHLER!' : ' – alles in Ordnung.'));
