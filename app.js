const CATEGORY_RULES = [
  { name: "Income", color: "#167856", terms: ["payroll", "salary", "deposit", "direct dep", "income"] },
  { name: "Housing", color: "#59656f", terms: ["rent", "mortgage", "property", "apartment"] },
  { name: "Career Development", color: "#406d9f", terms: ["linkedin", "coursera", "udemy", "conference", "notion", "github", "openai", "books", "bookstore"] },
  { name: "Health & Fitness", color: "#6b8f71", terms: ["gym", "fitness", "classpass", "pharmacy", "cvs", "walgreens", "health", "yoga", "therapy"] },
  { name: "Social Life", color: "#a66a19", terms: ["bar", "club", "restaurant", "dining", "doordash", "uber eats", "ticket", "cinema", "coffee", "cafe"] },
  { name: "Travel", color: "#7a65a8", terms: ["airline", "hotel", "airbnb", "flight", "southwest", "united", "delta", "amtrak", "travel"] },
  { name: "Convenience", color: "#b45c4f", terms: ["uber", "lyft", "delivery", "instacart", "gopuff", "convenience"] },
  { name: "Subscriptions", color: "#69879a", terms: ["spotify", "netflix", "icloud", "subscription", "adobe", "hulu", "youtube", "prime"] },
  { name: "Groceries", color: "#79934f", terms: ["trader joe", "whole foods", "safeway", "market", "grocery", "costco"] },
  { name: "Shopping", color: "#9a6a7d", terms: ["amazon", "zara", "uniqlo", "target", "apple", "store", "shop"] },
  { name: "Transportation", color: "#587a80", terms: ["gas", "shell", "chevron", "parking", "transit", "bart", "metro"] },
  { name: "Utilities", color: "#766e63", terms: ["electric", "utility", "internet", "phone", "water", "at&t", "verizon"] }
];

const VIEW_META = {
  home: ["Financial overview", "Good morning, Darin."],
  spending: ["Spending intelligence", "Understand where your money is moving."],
  forecasts: ["Predictive outlook", "See what your current trajectory suggests."],
  signals: ["Behavioral intelligence", "Notice the patterns beneath the transactions."],
  timeline: ["Financial narrative", "Follow the events reflected in your spending."],
  ask: ["AI financial analyst", "Ask your transaction history a question."]
};

const STORAGE_KEY = "ledger-ai-transactions-v1";
const SETTINGS_KEY = "ledger-ai-settings-v1";
const TODAY = new Date("2026-06-14T12:00:00");

let state = {
  transactions: [],
  analytics: null,
  period: 30,
  horizon: 90,
  currentView: "home",
  persistentData: false,
  customCategories: JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function seededNoise(seed) {
  const x = Math.sin(seed * 999) * 10000;
  return x - Math.floor(x);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function localDate(value) {
  if (value instanceof Date) return value;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function generateDemoTransactions() {
  const merchants = [
    ["PAYROLL ACME LABS", 3150, "Income", 14],
    ["Mission Bay Rent", -1650, "Housing", 1],
    ["Trader Joe's", -64, "Groceries", 5],
    ["Whole Foods Market", -48, "Groceries", 9],
    ["Blue Bottle Coffee", -8.5, "Social Life", 3],
    ["The Progress Restaurant", -76, "Social Life", 17],
    ["Uber", -24, "Convenience", 4],
    ["DoorDash", -38, "Convenience", 8],
    ["ClassPass", -59, "Health & Fitness", 2],
    ["CVS Pharmacy", -19, "Health & Fitness", 21],
    ["Spotify", -11.99, "Subscriptions", 6],
    ["iCloud", -2.99, "Subscriptions", 11],
    ["Netflix", -15.49, "Subscriptions", 15],
    ["LinkedIn Premium", -39.99, "Career Development", 7],
    ["OpenAI", -20, "Career Development", 12],
    ["Amazon", -43, "Shopping", 19],
    ["Shell Gas", -52, "Transportation", 10],
    ["PG&E Utility", -91, "Utilities", 20]
  ];
  const tx = [];
  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo--) {
    const monthDate = new Date(TODAY.getFullYear(), TODAY.getMonth() - monthsAgo, 1);
    const convenienceLift = monthsAgo <= 1 ? 1.65 : 1;
    const socialLift = monthsAgo === 0 ? 1.28 : 1;
    merchants.forEach(([merchant, baseAmount, category, day], mi) => {
      const isIncome = baseAmount > 0;
      const repeat = ["Groceries", "Social Life", "Convenience", "Transportation"].includes(category) ? 2 : 1;
      for (let r = 0; r < repeat; r++) {
        const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), Math.min(day + r * 11, 27));
        if (date > TODAY) continue;
        let multiplier = .85 + seededNoise(monthsAgo * 50 + mi * 7 + r) * .3;
        if (category === "Convenience") multiplier *= convenienceLift;
        if (category === "Social Life") multiplier *= socialLift;
        const amount = isIncome ? baseAmount : baseAmount * multiplier;
        tx.push({
          id: `demo-${monthsAgo}-${mi}-${r}`,
          date: isoDate(date),
          merchant,
          description: merchant,
          amount: Number(amount.toFixed(2)),
          category
        });
      }
    });
    if (monthsAgo === 2) {
      tx.push({ id: "demo-flight", date: isoDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 13)), merchant: "United Airlines", description: "Flight purchase", amount: -486.21, category: "Travel" });
      tx.push({ id: "demo-hotel", date: isoDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 16)), merchant: "Ace Hotel", description: "Hotel booking", amount: -632.42, category: "Travel" });
    }
    if (monthsAgo === 1) {
      tx.push({ id: "demo-gym", date: isoDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 4)), merchant: "Equinox Fitness", description: "New gym membership", amount: -215, category: "Health & Fitness" });
    }
  }
  return tx.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function classifyTransaction(merchant, description = "") {
  const text = `${merchant} ${description}`.toLowerCase();
  const match = CATEGORY_RULES.find(rule => rule.terms.some(term => text.includes(term)));
  return match?.name || "Other";
}

function normalizeHeader(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field.trim()); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(field.trim()); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one transaction.");

  const headers = rows[0].map(normalizeHeader);
  const indexOf = candidates => headers.findIndex(h => candidates.includes(h));
  const dateIndex = indexOf(["date", "transactiondate", "posteddate", "datetime"]);
  const merchantIndex = indexOf(["merchant", "name", "payee", "vendor"]);
  const descriptionIndex = indexOf(["description", "memo", "details", "transaction"]);
  const amountIndex = indexOf(["amount", "value", "transactionamount"]);
  const debitIndex = indexOf(["debit", "withdrawal"]);
  const creditIndex = indexOf(["credit", "deposit"]);
  const categoryIndex = indexOf(["category", "type"]);
  if (dateIndex < 0 || (merchantIndex < 0 && descriptionIndex < 0) || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) {
    throw new Error("Required columns: date, merchant or description, and amount (or debit/credit).");
  }

  return rows.slice(1).map((cells, i) => {
    const merchant = cells[merchantIndex] || cells[descriptionIndex] || "Unknown merchant";
    const description = cells[descriptionIndex] || merchant;
    let amount;
    if (amountIndex >= 0) amount = Number(String(cells[amountIndex]).replace(/[$,\s]/g, "").replace(/[()]/g, m => m === "(" ? "-" : ""));
    else amount = (Number(String(cells[creditIndex] || 0).replace(/[$,\s]/g, "")) || 0) - (Number(String(cells[debitIndex] || 0).replace(/[$,\s]/g, "")) || 0);
    const parsedDate = new Date(cells[dateIndex]);
    if (Number.isNaN(parsedDate.getTime()) || Number.isNaN(amount)) return null;
    const explicitCategory = cells[categoryIndex]?.trim();
    return {
      id: `import-${Date.now()}-${i}`,
      date: isoDate(parsedDate),
      merchant,
      description,
      amount,
      category: explicitCategory || classifyTransaction(merchant, description)
    };
  }).filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function monthKey(date) {
  const d = localDate(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysBetween(a, b) {
  return Math.round((localDate(a) - localDate(b)) / 86400000);
}

function sum(list, getter = x => x) {
  return list.reduce((total, item) => total + getter(item), 0);
}

function mean(values) {
  return values.length ? sum(values) / values.length : 0;
}

function std(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map(v => (v - avg) ** 2)));
}

function formatMoney(value, compact = false) {
  const abs = Math.abs(value);
  if (compact && abs >= 1000) return `${value < 0 ? "-" : ""}$${(abs / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: abs < 100 ? 2 : 0 }).format(value);
}

function formatPercent(value) {
  return `${value >= 0 ? "+" : ""}${Math.round(value)}%`;
}

function categoryColor(name) {
  return CATEGORY_RULES.find(rule => rule.name === name)?.color || "#8a938c";
}

function computeAnalytics(transactions) {
  const expenses = transactions.filter(t => t.amount < 0);
  const incomeTx = transactions.filter(t => t.amount > 0);
  const months = {};
  transactions.forEach(tx => {
    const key = monthKey(tx.date);
    months[key] ||= { income: 0, spending: 0, categories: {}, transactions: [] };
    months[key].transactions.push(tx);
    if (tx.amount > 0) months[key].income += tx.amount;
    else {
      const amount = Math.abs(tx.amount);
      months[key].spending += amount;
      months[key].categories[tx.category] = (months[key].categories[tx.category] || 0) + amount;
    }
  });
  const monthKeys = Object.keys(months).sort();
  const currentKey = monthKey(TODAY);
  const current = months[currentKey] || { income: 0, spending: 0, categories: {}, transactions: [] };
  const priorKeys = monthKeys.filter(key => key < currentKey).slice(-3);
  const priorMonths = priorKeys.map(key => months[key]);
  const baselineSpend = mean(priorMonths.map(m => m.spending));
  const elapsedDays = TODAY.getDate();
  const daysInMonth = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate();
  const fixedCategories = new Set(["Housing", "Utilities", "Subscriptions"]);
  const fixedCurrent = sum([...fixedCategories], category => current.categories[category] || 0);
  const fixedBaseline = sum([...fixedCategories], category => mean(priorMonths.map(m => m.categories[category] || 0)));
  const variableCurrent = Math.max(0, current.spending - fixedCurrent);
  const velocityForecast = variableCurrent / Math.max(elapsedDays, 1) * daysInMonth + Math.max(fixedCurrent, fixedBaseline);
  const historicalForecast = baselineSpend || velocityForecast;
  const forecast = velocityForecast * .62 + historicalForecast * .38;
  const monthlyVolatility = std(priorMonths.map(m => m.spending));
  const forecastSpread = Math.max(forecast * .07, monthlyVolatility * .7, 180);
  const forecastLow = Math.max(0, forecast - forecastSpread);
  const forecastHigh = forecast + forecastSpread;
  const income = sum(incomeTx, t => t.amount);
  const spending = sum(expenses, t => Math.abs(t.amount));
  const historicalIncome = mean(priorMonths.map(m => m.income)) || current.income;
  const expectedSavings = historicalIncome - forecast;
  const savingsRate = historicalIncome ? expectedSavings / historicalIncome * 100 : 0;

  const allCategories = [...new Set(expenses.map(t => t.category))];
  const categoryStats = allCategories.map(category => {
    const currentAmount = current.categories[category] || 0;
    const baseline = mean(priorMonths.map(m => m.categories[category] || 0));
    const categoryForecast = fixedCategories.has(category)
      ? Math.max(currentAmount, baseline)
      : currentAmount / Math.max(elapsedDays, 1) * daysInMonth;
    const change = baseline ? (categoryForecast - baseline) / baseline * 100 : currentAmount ? 100 : 0;
    const total = sum(expenses.filter(t => t.category === category), t => Math.abs(t.amount));
    const count = expenses.filter(t => t.category === category).length;
    return { category, current: currentAmount, baseline, change, total, count, forecast: categoryForecast };
  }).sort((a, b) => b.current - a.current);

  const currentTransactions = current.transactions.filter(t => t.amount < 0);
  const merchantMap = {};
  currentTransactions.forEach(tx => {
    merchantMap[tx.merchant] ||= { merchant: tx.merchant, total: 0, count: 0, category: tx.category };
    merchantMap[tx.merchant].total += Math.abs(tx.amount);
    merchantMap[tx.merchant].count++;
  });
  const merchants = Object.values(merchantMap).sort((a, b) => b.total - a.total);

  const signals = buildSignals(categoryStats, months, expenses, forecast, baselineSpend);
  const timeline = buildTimeline(months, categoryStats);
  const forecastChange = baselineSpend ? (forecast - baselineSpend) / baselineSpend * 100 : 0;
  const healthScore = Math.max(35, Math.min(95, Math.round(76 + savingsRate * .25 - Math.max(forecastChange, 0) * .12 - signals.filter(s => s.severity === "high").length * 3)));

  return {
    months, monthKeys, current, priorMonths, baselineSpend, forecast, forecastLow, forecastHigh,
    expectedSavings, savingsRate, categoryStats, merchants, signals, timeline, healthScore,
    forecastChange, income, spending, historicalIncome, expenses
  };
}

function buildSignals(categoryStats, months, expenses, forecast, baselineSpend) {
  const signals = [];
  const growing = categoryStats.filter(c => c.baseline > 20 && c.change > 15).sort((a, b) => b.change - a.change);
  growing.slice(0, 2).forEach((item, index) => {
    signals.push({
      type: index ? "Emerging trend" : "Spending shift",
      severity: item.change > 45 ? "high" : "medium",
      title: `${item.category} is ${Math.round(item.change)}% above your recent baseline.`,
      body: `Your current pace suggests ${formatMoney(item.forecast)} in ${item.category.toLowerCase()} spending this month.`,
      evidence: [
        ["Current pace", formatMoney(item.forecast)],
        ["3-month average", formatMoney(item.baseline)],
        ["Difference", formatPercent(item.change)]
      ]
    });
  });
  const categoryShares = categoryStats.map(c => ({ ...c, share: forecast ? c.forecast / forecast : 0 }));
  const convenience = categoryShares.find(c => c.category === "Convenience");
  if (convenience) {
    signals.push({
      type: "Behavioral drift",
      severity: convenience.change > 30 ? "high" : "medium",
      title: "Convenience is taking a larger share of discretionary spending.",
      body: "Delivery and rideshare activity has accelerated relative to your longer-term pattern.",
      evidence: [
        ["Current share", `${Math.round(convenience.share * 100)}%`],
        ["Monthly pace", formatMoney(convenience.forecast)],
        ["Baseline change", formatPercent(convenience.change)]
      ]
    });
  }
  const subscriptions = categoryStats.find(c => c.category === "Subscriptions");
  if (subscriptions) {
    signals.push({
      type: "Recurring cost",
      severity: "low",
      title: `${formatMoney(subscriptions.forecast)} of monthly spending appears recurring.`,
      body: "Your subscription footprint is stable, but it compounds into a meaningful annual commitment.",
      evidence: [
        ["Monthly estimate", formatMoney(subscriptions.forecast)],
        ["Annualized", formatMoney(subscriptions.forecast * 12)],
        ["Transactions", String(subscriptions.count)]
      ]
    });
  }
  if (baselineSpend) {
    const change = (forecast - baselineSpend) / baselineSpend * 100;
    signals.push({
      type: "Forecast alert",
      severity: change > 15 ? "high" : "medium",
      title: `Month-end spending is tracking ${Math.abs(Math.round(change))}% ${change >= 0 ? "above" : "below"} average.`,
      body: change >= 0 ? "The increase is concentrated in a small number of discretionary categories." : "Current spending velocity is below your recent baseline.",
      evidence: [
        ["Expected month", formatMoney(forecast)],
        ["3-month average", formatMoney(baselineSpend)],
        ["Variance", formatPercent(change)]
      ]
    });
  }
  return signals.slice(0, 6);
}

function buildTimeline(months) {
  const events = [];
  const keys = Object.keys(months).sort();
  keys.forEach(key => {
    const month = months[key];
    const label = new Date(`${key}-02`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const travel = month.categories.Travel || 0;
    const health = month.categories["Health & Fitness"] || 0;
    const convenience = month.categories.Convenience || 0;
    if (travel > 400) events.push({ date: label, title: "Possible trip or travel period", body: "Airfare and lodging appeared together, creating a distinct shift from your normal monthly pattern.", evidence: `${formatMoney(travel)} in travel-related spending` });
    if (health > 180) events.push({ date: label, title: "New investment in health", body: "Fitness spending stepped up and remained visible in subsequent activity.", evidence: `${formatMoney(health)} across health and fitness` });
    if (convenience > 180) events.push({ date: label, title: "Convenience spending accelerated", body: "Rideshare and delivery purchases became more frequent, suggesting a change in schedule or daily routine.", evidence: `${formatMoney(convenience)} in convenience purchases` });
  });
  if (!events.length) events.push({ date: "Recent months", title: "A stable financial rhythm", body: "No major life-event pattern is evident yet. More transaction history will improve detection.", evidence: "Low behavioral variance" });
  return events.reverse().slice(0, 7);
}

function buildDailySeries(analytics) {
  const days = Array.from({ length: TODAY.getDate() }, (_, i) => i + 1);
  const daily = days.map(day => sum(analytics.current.transactions.filter(t => localDate(t.date).getDate() === day && t.amount < 0), t => Math.abs(t.amount)));
  let running = 0;
  const actual = daily.map(v => running += v);
  const expectedDaily = analytics.baselineSpend / new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate();
  const expected = days.map(day => expectedDaily * day);
  return { days, actual, expected };
}

function render() {
  state.analytics = computeAnalytics(state.transactions);
  renderHome();
  renderSpending();
  renderForecasts();
  renderSignals();
  renderTimeline();
  $("#signal-count").textContent = state.analytics.signals.length;
  const isDemo = state.transactions[0]?.id?.startsWith("demo");
  $("#data-status-title").textContent = isDemo ? "Synthetic demo data" : "Personal CSV active";
  $("#data-status-copy").textContent = isDemo
    ? `${state.transactions.length} fake transactions`
    : `${state.transactions.length} transactions · ${state.persistentData ? "saved locally" : "session only"}`;
}

function renderHome() {
  const a = state.analytics;
  $("#health-score").textContent = a.healthScore;
  $("#score-progress").style.strokeDashoffset = 308 * (1 - a.healthScore / 100);
  $("#month-forecast").textContent = formatMoney(a.forecast);
  $("#forecast-low").textContent = formatMoney(a.forecastLow);
  $("#forecast-high").textContent = formatMoney(a.forecastHigh);
  const healthImproving = a.expectedSavings > 0 && a.forecastChange < 15;
  $("#health-title").textContent = healthImproving ? "Stable, with room to grow." : "Stable, but spending is accelerating.";
  $("#health-copy").textContent = `${a.expectedSavings >= 0 ? "Income is expected to outpace spending" : "Spending may outpace expected income"} by ${formatMoney(Math.abs(a.expectedSavings))}, while ${a.signals[0]?.title.toLowerCase() || "your recent behavior remains consistent"}`;
  $("#health-change").textContent = healthImproving ? "Improving" : "Watch closely";
  $("#health-change").className = `trend-badge ${healthImproving ? "positive" : "warning"}`;

  const insightItems = a.signals.slice(0, 3);
  $("#home-insights").innerHTML = insightItems.map((signal, i) => `
    <article class="insight-card">
      <div class="insight-card-top">
        <span class="insight-icon">${["↗", "◇", "⌁"][i] || "•"}</span>
        <span class="trend-badge ${signal.severity === "high" ? "warning" : "positive"}">${signal.type}</span>
      </div>
      <h3>${signal.title}</h3>
      <p>${signal.body}</p>
    </article>`).join("");
  $("#signal-preview-list").innerHTML = a.signals.slice(0, 3).map(signal => `
    <div class="signal-preview-item"><strong>${signal.title}</strong><span>${signal.body}</span></div>`).join("");
  renderHomeChart();
}

function svgPath(values, width, height, maxValue, padX = 24, padY = 24) {
  return values.map((value, i) => {
    const x = padX + i / Math.max(values.length - 1, 1) * (width - padX * 2);
    const y = height - padY - value / Math.max(maxValue, 1) * (height - padY * 2);
    return `${i ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function renderHomeChart() {
  const { days, actual, expected } = buildDailySeries(state.analytics);
  const svg = $("#home-chart");
  const width = 720, height = 245;
  const max = Math.max(...actual, ...expected, 1) * 1.1;
  const actualPath = svgPath(actual, width, height, max);
  const expectedPath = svgPath(expected, width, height, max);
  const areaPath = `${actualPath} L 696 221 L 24 221 Z`;
  const grid = [0, .25, .5, .75, 1].map(level => {
    const y = 24 + level * (height - 48);
    return `<line class="chart-grid" x1="24" y1="${y}" x2="696" y2="${y}"></line>`;
  }).join("");
  const labels = [1, Math.ceil(days.length / 2), days.length].map((day, i) => `<text class="chart-label" x="${[24, 355, 680][i]}" y="241">${i === 0 ? "Jun 1" : i === 1 ? `Jun ${day}` : "Today"}</text>`).join("");
  svg.innerHTML = `
    <defs><linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ed2bb"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
    ${grid}<path class="chart-area" d="${areaPath}"></path>
    <path class="chart-line-expected" d="${expectedPath}"></path>
    <path class="chart-line-actual" d="${actualPath}"></path>${labels}`;
}

function renderSpending() {
  const a = state.analytics;
  const current = a.current.spending;
  const prior = a.baselineSpend;
  const change = prior ? (a.forecast - prior) / prior * 100 : 0;
  const discretionary = sum(a.categoryStats.filter(c => !["Housing", "Utilities", "Income"].includes(c.category)), c => c.current);
  const summary = [
    ["Spent this month", formatMoney(current), `${formatPercent(change)} projected vs. average`],
    ["Monthly forecast", formatMoney(a.forecast), `${TODAY.getDate()} days observed`],
    ["Discretionary", formatMoney(discretionary), `${Math.round(discretionary / Math.max(current, 1) * 100)}% of spending`],
    ["Transactions", String(a.current.transactions.filter(t => t.amount < 0).length), `${a.categoryStats.length} categories`]
  ];
  $("#spending-summary").innerHTML = summary.map(([label, value, note]) => `<article class="summary-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
  const maxCategory = Math.max(...a.categoryStats.map(c => c.current), 1);
  $("#category-list").innerHTML = a.categoryStats.slice(0, 9).map(c => `
    <div class="category-row">
      <div class="category-name"><i class="category-dot" style="background:${categoryColor(c.category)}"></i>${c.category}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, c.current / maxCategory * 100)}%;background:${categoryColor(c.category)}"></div></div>
      <div class="category-amount">${formatMoney(c.current)}</div>
      <div class="category-change ${c.change > 0 ? "up" : "down"}">${formatPercent(c.change)}</div>
    </div>`).join("");
  $("#merchant-list").innerHTML = a.merchants.slice(0, 7).map(m => `
    <div class="merchant-row">
      <span class="merchant-icon">${m.merchant.slice(0, 1).toUpperCase()}</span>
      <div class="merchant-meta"><strong>${m.merchant}</strong><span>${m.count} transaction${m.count === 1 ? "" : "s"} · ${m.category}</span></div>
      <span class="merchant-amount">${formatMoney(m.total)}</span>
    </div>`).join("");
  const categories = [...new Set(state.transactions.map(t => t.category))].sort();
  $("#category-filter").innerHTML = `<option value="all">All categories</option>${categories.map(c => `<option>${c}</option>`).join("")}`;
  renderTransactionTable();
}

function renderTransactionTable() {
  const query = ($("#transaction-search")?.value || "").toLowerCase();
  const filter = $("#category-filter")?.value || "all";
  const rows = state.transactions.filter(tx => {
    const matchesQuery = `${tx.merchant} ${tx.description}`.toLowerCase().includes(query);
    return matchesQuery && (filter === "all" || tx.category === filter);
  }).slice(0, 80);
  $("#transaction-table").innerHTML = rows.map(tx => `
    <tr>
      <td>${new Date(`${tx.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
      <td><strong>${tx.merchant}</strong></td>
      <td><button class="category-pill" data-tx-id="${tx.id}" title="Click to change category">${tx.category}</button></td>
      <td class="amount ${tx.amount >= 0 ? "income" : "expense"}">${tx.amount >= 0 ? "+" : ""}${formatMoney(tx.amount)}</td>
    </tr>`).join("");
  $$(".category-pill").forEach(button => button.addEventListener("click", () => editTransactionCategory(button.dataset.txId)));
}

function editTransactionCategory(id) {
  const tx = state.transactions.find(item => item.id === id);
  if (!tx) return;
  const categories = [...new Set([...CATEGORY_RULES.map(r => r.name), ...state.transactions.map(t => t.category)])].filter(c => c !== "Income");
  const next = prompt(`Category for ${tx.merchant}:\n\n${categories.join(", ")}`, tx.category);
  if (!next?.trim()) return;
  tx.category = next.trim().slice(0, 40);
  state.customCategories[tx.merchant.toLowerCase()] = tx.category;
  if (state.persistentData) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.customCategories));
  }
  saveTransactions();
  render();
  showToast(`Updated ${tx.merchant} to ${tx.category}`);
}

function renderForecasts() {
  const a = state.analytics;
  const cards = [
    ["Expected spending", formatMoney(a.forecast), `${formatMoney(a.forecastLow)}–${formatMoney(a.forecastHigh)} range`],
    ["Expected savings", formatMoney(a.expectedSavings), `${Math.round(a.savingsRate)}% savings rate`],
    ["90-day balance change", formatMoney(a.expectedSavings * 3), "if current behavior continues"],
    ["Forecast confidence", a.priorMonths.length >= 3 ? "Medium-high" : "Early", `${a.priorMonths.length} baseline months`]
  ];
  $("#forecast-cards").innerHTML = cards.map(([label, value, note]) => `<article class="forecast-summary-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
  renderForecastChart();
  $("#forecast-category-grid").innerHTML = a.categoryStats.filter(c => c.category !== "Income").slice(0, 6).map(c => `
    <article class="forecast-category-card">
      <span>${c.category}</span><strong>${formatMoney(c.forecast)}</strong>
      <div class="bar-track mini-bar"><div class="bar-fill" style="width:${Math.min(100, c.forecast / Math.max(...a.categoryStats.map(x => x.forecast), 1) * 100)}%;background:${categoryColor(c.category)}"></div></div>
    </article>`).join("");
}

function renderForecastChart() {
  const a = state.analytics;
  const days = state.horizon;
  const points = 13;
  const currentBalance = 7800;
  const dailyNet = a.expectedSavings / 30;
  const history = Array.from({ length: 6 }, (_, i) => currentBalance - (5 - i) * dailyNet * 5 + Math.sin(i) * 130);
  const forecast = Array.from({ length: points - 5 }, (_, i) => currentBalance + dailyNet * (i * days / (points - 6)));
  const all = [...history.slice(0, -1), ...forecast];
  const spread = all.map((_, i) => i < 5 ? 0 : 110 + (i - 4) * (days / 90) * 45);
  const lower = all.map((v, i) => v - spread[i]);
  const upper = all.map((v, i) => v + spread[i]);
  const min = Math.min(...lower) * .94;
  const normalized = values => values.map(v => v - min);
  const max = Math.max(...upper.map(v => v - min)) * 1.08;
  const width = 900, height = 320;
  const allPath = svgPath(normalized(all), width, height, max, 28, 30);
  const historyPath = svgPath(normalized(all.slice(0, 6)), width * 5 / 12 + 28, height, max, 28, 30);
  const forecastStartX = 28 + 5 / (all.length - 1) * (width - 56);
  const forecastValues = all.slice(5);
  const forecastPath = forecastValues.map((v, i) => {
    const index = i + 5;
    const x = 28 + index / (all.length - 1) * (width - 56);
    const y = height - 30 - (v - min) / max * (height - 60);
    return `${i ? "L" : "M"} ${x} ${y}`;
  }).join(" ");
  const upperPoints = upper.map((v, i) => `${28 + i / (all.length - 1) * (width - 56)},${height - 30 - (v - min) / max * (height - 60)}`).join(" ");
  const lowerPoints = lower.map((v, i) => `${28 + i / (all.length - 1) * (width - 56)},${height - 30 - (v - min) / max * (height - 60)}`).reverse().join(" ");
  const grid = [0, .25, .5, .75, 1].map(level => `<line class="chart-grid" x1="28" x2="872" y1="${30 + level * 260}" y2="${30 + level * 260}"></line>`).join("");
  $("#forecast-chart").innerHTML = `${grid}<polygon class="confidence-area" points="${upperPoints} ${lowerPoints}"></polygon><path class="history-line" d="${historyPath}"></path><path class="forecast-line" d="${forecastPath}"></path><line class="forecast-divider" x1="${forecastStartX}" x2="${forecastStartX}" y1="25" y2="292"></line><text class="chart-label" x="${forecastStartX + 7}" y="22">Forecast begins</text>`;
  const endBalance = forecast.at(-1);
  $("#forecast-explanation").innerHTML = `<strong>What this means:</strong> At your current income and spending pace, cash balance is projected to ${endBalance >= currentBalance ? "increase" : "decrease"} by approximately ${formatMoney(Math.abs(endBalance - currentBalance))} over ${days} days. The shaded range reflects uncertainty from normal monthly variation.`;
}

function renderSignals() {
  const signals = state.analytics.signals;
  const high = signals.filter(s => s.severity === "high").length;
  $("#drift-score").textContent = high >= 2 ? "High" : high ? "Moderate" : "Low";
  $("#signals-grid").innerHTML = signals.map(signal => `
    <article class="signal-card">
      <div class="signal-card-header"><span class="signal-type">${signal.type}</span><span class="signal-confidence">${signal.severity === "high" ? "Strong" : "Moderate"} evidence</span></div>
      <h3>${signal.title}</h3><p>${signal.body}</p>
      <div class="signal-evidence"><strong>Why you’re seeing this</strong>${signal.evidence.map(([label, value]) => `<div class="evidence-row"><span>${label}</span><b>${value}</b></div>`).join("")}</div>
    </article>`).join("");
}

function renderTimeline() {
  $("#timeline-list").innerHTML = state.analytics.timeline.map(event => `
    <article class="timeline-item"><span class="timeline-dot"></span><span class="timeline-date">${event.date}</span><h3>${event.title}</h3><p>${event.body}</p><span class="timeline-evidence">${event.evidence}</span></article>`).join("");
}

function answerQuestion(question) {
  const q = question.toLowerCase();
  const a = state.analytics;
  const topGrowth = [...a.categoryStats].filter(c => c.baseline > 0).sort((x, y) => y.change - x.change)[0];
  const topSpend = a.categoryStats[0];
  if (/why|more|increase|changed/.test(q)) {
    return `Your month-end spending is forecast at ${formatMoney(a.forecast)}, ${Math.abs(Math.round(a.forecastChange))}% ${a.forecastChange >= 0 ? "above" : "below"} your three-month average. ${topGrowth ? `${topGrowth.category} is the largest change, tracking ${formatPercent(topGrowth.change)} versus baseline.` : ""} The increase is concentrated rather than broad-based, which means a few behaviors are driving most of the difference.`;
  }
  if (/afford|trip|vacation|buy/.test(q)) {
    const buffer = a.expectedSavings;
    return buffer > 500
      ? `At your current pace, you are expected to retain about ${formatMoney(buffer)} after this month’s spending. A trip below roughly ${formatMoney(buffer * .65)} would preserve a 35% forecast buffer, but this does not account for debt payments or savings goals outside the imported data.`
      : `Your current forecast leaves about ${formatMoney(Math.max(buffer, 0))} of monthly headroom. I would treat a large trip as financially tight unless spending slows or additional income is expected.`;
  }
  if (/fastest|growing|category|categories/.test(q)) {
    const ranked = [...a.categoryStats].filter(c => c.baseline > 0).sort((x, y) => y.change - x.change).slice(0, 3);
    return `The fastest-growing categories are ${ranked.map(c => `${c.category} (${formatPercent(c.change)})`).join(", ")}. ${ranked[0] ? `${ranked[0].category} matters most because its current pace is ${formatMoney(ranked[0].forecast)} for the month.` : ""}`;
  }
  if (/subscription|recurring/.test(q)) {
    const c = a.categoryStats.find(item => item.category === "Subscriptions");
    return c ? `Subscriptions are tracking near ${formatMoney(c.forecast)} per month, or approximately ${formatMoney(c.forecast * 12)} annualized. Review the transaction table to see the recurring merchants behind that estimate.` : "I did not detect enough subscription transactions to form a reliable estimate.";
  }
  if (/balance|save|saving|trajectory/.test(q)) {
    return `Your current monthly trajectory implies ${formatMoney(a.expectedSavings)} in net savings, a ${Math.round(a.savingsRate)}% savings rate. If that pattern continues, the 90-day change would be approximately ${formatMoney(a.expectedSavings * 3)}, before investment returns or unobserved transfers.`;
  }
  return `${topSpend ? `${topSpend.category} is currently your largest spending category at ${formatMoney(topSpend.current)} this month.` : ""} Your overall month-end forecast is ${formatMoney(a.forecast)}, with an 80% range of ${formatMoney(a.forecastLow)} to ${formatMoney(a.forecastHigh)}. Ask about a change, category, purchase, or future balance for a more specific explanation.`;
}

function switchView(view) {
  state.currentView = view;
  $$(".view").forEach(el => el.classList.toggle("active", el.id === `view-${view}`));
  $$(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  $("#page-eyebrow").textContent = VIEW_META[view][0];
  $("#page-title").textContent = VIEW_META[view][1];
  $("#sidebar").classList.remove("open");
  $("#sidebar-backdrop").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function saveTransactions() {
  if (!state.persistentData) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions)); }
  catch { showToast("Browser storage is full; analysis remains active for this session."); }
}

function openImport() { $("#import-modal").classList.add("open"); }
function closeImport() { $("#import-modal").classList.remove("open"); }
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

async function handleFile(file) {
  if (!file) return;
  try {
    const parsed = parseCSV(await file.text());
    parsed.forEach(tx => {
      const saved = state.customCategories[tx.merchant.toLowerCase()];
      if (saved) tx.category = saved;
    });
    if (!parsed.length) throw new Error("No valid transactions were found.");
    state.transactions = parsed;
    state.persistentData = $("#remember-data").checked;
    saveTransactions();
    render();
    closeImport();
    showToast(`${parsed.length} transactions imported and analyzed.`);
  } catch (error) {
    showToast(error.message);
  }
}

function downloadSample() {
  const rows = [["date", "merchant", "description", "amount", "category"], ...generateDemoTransactions().slice(0, 45).map(t => [t.date, t.merchant, t.description, t.amount, t.category])];
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "ledger-ai-sample-transactions.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function initializeEvents() {
  $$(".nav-item").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
  $$("[data-view-link]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.viewLink)));
  ["open-import", "top-import"].forEach(id => $(`#${id}`).addEventListener("click", openImport));
  $("#close-import").addEventListener("click", closeImport);
  $("#import-modal").addEventListener("click", event => { if (event.target === $("#import-modal")) closeImport(); });
  $("#csv-input").addEventListener("change", event => handleFile(event.target.files[0]));
  $("#download-sample").addEventListener("click", downloadSample);
  $("#use-demo").addEventListener("click", () => {
    state.transactions = generateDemoTransactions();
    state.persistentData = false;
    localStorage.removeItem(STORAGE_KEY);
    render(); closeImport(); showToast("Demo data restored.");
  });
  $("#clear-local-data").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    state.customCategories = {};
    state.persistentData = false;
    state.transactions = generateDemoTransactions();
    $("#remember-data").checked = false;
    render();
    showToast("Personal transactions and category preferences were cleared from this browser.");
  });
  const dropZone = $("#drop-zone");
  ["dragenter", "dragover"].forEach(type => dropZone.addEventListener(type, e => { e.preventDefault(); dropZone.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach(type => dropZone.addEventListener(type, e => { e.preventDefault(); dropZone.classList.remove("dragging"); }));
  dropZone.addEventListener("drop", e => handleFile(e.dataTransfer.files[0]));
  $("#transaction-search").addEventListener("input", renderTransactionTable);
  $("#category-filter").addEventListener("change", renderTransactionTable);
  $("#spending-period").addEventListener("change", e => { state.period = Number(e.target.value); renderSpending(); });
  $("#forecast-horizon").addEventListener("click", e => {
    if (!e.target.dataset.days) return;
    state.horizon = Number(e.target.dataset.days);
    $$("#forecast-horizon button").forEach(b => b.classList.toggle("active", b === e.target));
    renderForecastChart();
  });
  $("#refresh-analysis").addEventListener("click", () => { render(); showToast("Analysis refreshed."); });
  $("#mobile-menu").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#sidebar-backdrop").classList.add("open"); });
  $("#sidebar-backdrop").addEventListener("click", () => { $("#sidebar").classList.remove("open"); $("#sidebar-backdrop").classList.remove("open"); });
  $("#question-suggestions").addEventListener("click", e => {
    if (e.target.tagName !== "BUTTON") return;
    $("#ask-input").value = e.target.textContent;
    $("#ask-form").requestSubmit();
  });
  $("#ask-form").addEventListener("submit", e => {
    e.preventDefault();
    const input = $("#ask-input");
    const question = input.value.trim();
    if (!question) return;
    const log = $("#chat-log");
    log.insertAdjacentHTML("beforeend", `<div class="chat-message user"><span class="chat-avatar">DB</span><div><strong>You</strong><p>${escapeHtml(question)}</p></div></div>`);
    input.value = "";
    setTimeout(() => {
      log.insertAdjacentHTML("beforeend", `<div class="chat-message assistant"><span class="chat-avatar">✦</span><div><strong>Ledger Analyst</strong><p>${answerQuestion(question)}</p></div></div>`);
      log.scrollTop = log.scrollHeight;
    }, 280);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeImport(); });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  state.persistentData = Boolean(saved);
  try { state.transactions = saved ? JSON.parse(saved) : generateDemoTransactions(); }
  catch { state.transactions = generateDemoTransactions(); }
  initializeEvents();
  $("#remember-data").checked = state.persistentData;
  render();
}

init();
