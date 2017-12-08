const m = window.m;
let coins = null;

function getCoins() {
  fetch('https://api.coinmarketcap.com/v1/ticker/')
      .then((r) => r.json())
      .then((j) => {
        coins = j;
        m.redraw();
      });
}

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
    ));

const formatUSD = (usd) => usd.toLocaleString('en', {
  style: 'currency',
  currency: 'usd',
});

const formatPercentage = (p, d = 0) =>
    ((p !== 0 && !isNaN(p)) ? (p + d).toLocaleString('en', {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) :
                              '∞');

const coinRow = (coin) => {
  const currentPrice = parseFloat(coin.price_usd);
  const currentHolding = state.holdings[coin.symbol];
  const currentHoldingValue = currentPrice * currentHolding;
  const purchaseValue =
      (state.purchasePrices[coin.symbol] || 0) * currentHolding;
  return m('tr', [
    m('th', coin.symbol),
    m('th', coin.name),
    m('td.num', currentPrice.toLocaleString('en', {
      style: 'decimal',
      minimumFractionDigits: 6,
      maximumFractionDigits: 6
    })),

    m('td', numberInput({
        value: state.purchasePrices[coin.symbol],
        oninput: setter('purchasePrices', coin.symbol)
      })),
    m('td',
      numberInput(
          {value: currentHolding, oninput: setter('holdings', coin.symbol)})),
    m('td.num',
      (currentHolding ?
           formatPercentage(currentHoldingValue / purchaseValue, -1) :
           null)),
    m('td.num', (currentHolding ? formatUSD(currentHoldingValue) : null)),
    m('td.num',
      (currentHolding ? formatUSD(currentHoldingValue - purchaseValue) : null)),
  ]);
};

const coinTable = () =>
    m('table',
      m('thead',
        [
          'Symbol', 'Name', 'USD', 'Avg Purch $', 'Current Holding', '%', '$',
          'Δ$'
        ].map((caption) => m('th', caption))),
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
  const percentageString = formatPercentage((currentTotal / purchaseTotal), -1);
  const usdDeltaString = formatUSD(currentTotal - purchaseTotal);
  const usdString = formatUSD(currentTotal);
  return m(
      'div.inner',
      m('div.percentage', percentageString),
      m('div.fiat', usdString),
      m('div.fiat', 'Δ ' + usdDeltaString),
  );
};

const view = () => {
  if (coins === null) return m('div#loading', 'Loading from Coinmarketcap...');
  return m('main', [
    m('div#table', coinTable()),
    m('div#result', resultDiv()),
    m('button#reload', {onClick: getCoins}, 'Refresh'),
  ]);
};

m.mount(document.body, {view});
getCoins();