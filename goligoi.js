const m = window.m;
let coins = null;
fetch('https://api.coinmarketcap.com/v1/ticker/')
    .then((r) => r.json())
    .then((j) => {
      coins = j;
      m.redraw();
    });

const state = {
  purchasePrices: {},
  holdings: {},
};

Object.assign(state, JSON.parse(localStorage.getItem('goligoi-state') || '{}'));

const setter = (table, symbol) => (event) => {
  state[table][symbol] =
      (event.target.value === '' ? null : event.target.valueAsNumber);
  localStorage.setItem('goligoi-state', JSON.stringify(state));
};

const numberInput = (props) => (m(
    'input',
    Object.assign({type: 'number', step: 0.00001, min: 0}, props),
    )

);

const coinRow = (coin) => (m('tr', [
  m('th', coin.symbol),
  m('th', coin.name),
  m('td.num', parseFloat(coin.price_usd).toLocaleString('en', {
    style: 'decimal',
    minimumFractionDigits: 6,
    maximumFractionDigits: 6
  })),

  m('td', numberInput({
      value: state.purchasePrices[coin.symbol],
      oninput: setter('purchasePrices', coin.symbol)
    })),
  m('td', numberInput({
      value: state.holdings[coin.symbol],
      oninput: setter('holdings', coin.symbol)
    })),
]));

const coinTable = () =>
    m('table',
      m('thead',
        ['Symbol', 'Name', 'USD', 'Avg Purchase Price', 'Current Holding'].map(
            (caption) => m('th', caption))),
      m('tbody', coins.map((coin) => coinRow(coin))));

const resultDiv = () => {
  let purchaseTotal = 0;
  let currentTotal = 0;
  (coins || []).forEach((coin) => {
    const purchasePrice = state.purchasePrices[coin.symbol] || 0;
    const holding = state.holdings[coin.symbol] || null;
    if (holding) {
      purchaseTotal += purchasePrice * holding;
      currentTotal += parseFloat(coin.price_usd) * holding;
    }
  });
  if (currentTotal === 0) return;
  const percentageString =
      (purchaseTotal > 0 ?
           ((currentTotal / purchaseTotal) - 1).toLocaleString('en', {
             style: 'percent',
             minimumFractionDigits: 0,
             maximumFractionDigits: 2,
           }) :
           '∞');
  const usdDeltaString = (currentTotal - purchaseTotal).toLocaleString('en', {
    style: 'currency',
    currency: 'usd',
  });
  const usdString = (currentTotal).toLocaleString('en', {
    style: 'currency',
    currency: 'usd',
  });
  return m(
      'div.inner',
      m('div.percentage', percentageString),
      m('div.fiat', usdString),
      m('div.fiat', 'Δ ' + usdDeltaString),
  );
};

const view = () => {
  if (coins === null) return m('div', 'Loading from Coinmarketcap...');
  return m('main', m('div#table', coinTable()), m('div#result', resultDiv()));
};

m.mount(document.body, {view});