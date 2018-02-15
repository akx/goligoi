const m = window.m;
let coins = null;

function drawText(t, e, n, l) {
  const o = {
      0: 15214,
      1: 9370,
      2: 29347,
      3: 14499,
      4: 18925,
      5: 14543,
      6: 31694,
      7: 4775,
      8: 31727,
      9: 31215,
      '.': 8192,
      '-': 448,
      k: 22249,
    },
    c = e;
  for (let f = 0; f < l.length; f++) {
    const s = l[f];
    if (('.' === s && e--, '\n' === s)) (n += 7), (e = c);
    else {
      const l = o[s] || 65535;
      for (let o = 0; 15 > o; o++) l & (1 << o) && t.fillRect(e + o % 3, n + (0 | (o / 3)), 1, 1);
      e += '1' === s || '.' === s ? 3 : 4;
    }
  }
}

function renderFavicon(num) {
  const s = (num / 1000).toFixed(2).replace('.', '.\n') + 'k';
  const canvas = Object.assign(document.createElement('canvas'), { width: 16, height: 16 });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = 'gold';
  drawText(ctx, 2, 2, s);
  const png = canvas.toDataURL('image/png');
  const link = document.querySelector('link[rel*=\'icon\']') || document.createElement('link');
  link.type = 'image/x-icon';
  link.rel = 'shortcut icon';
  link.href = png;
  document.getElementsByTagName('head')[0].appendChild(link);
}

function getCoins() {
  return fetch('https://api.coinmarketcap.com/v1/ticker/')
    .then(r => r.json())
    .then(j => {
      coins = j;
      m.redraw();
    })
    .then(() => {
      const totals = calculateTotals(state);
      renderFavicon(totals.currentTotal);
      saveTimeSeries(totals);
    });
}

const state = {
  purchasePrices: {},
  holdings: {},
  autorefresh: false,
};

function calculateTotals() {
  let purchaseTotal = 0;
  let currentTotal = 0;
  (coins || []).forEach(coin => {
    const purchasePrice = state.purchasePrices[coin.symbol] || 0;
    const holding = state.holdings[coin.symbol] || null;
    if (holding) {
      purchaseTotal += purchasePrice * holding;
      currentTotal += parseFloat(coin.price_usd) * holding;
    }
  });
  return { currentTotal, purchaseTotal };
}

function saveState() {
  localStorage.setItem('goligoi-state', JSON.stringify(state));
}

function loadState() {
  Object.assign(state, JSON.parse(localStorage.getItem('goligoi-state') || '{}'));
}

function saveTimeSeries(values) {
  const timestamp = Math.round(+new Date() / 1000);
  const bucketId = Math.floor(timestamp / 86400)
    .toString(16)
    .padStart(5, '0');
  const bucketName = `goligoi-ts-${bucketId}`;
  const bucketArray = JSON.parse(localStorage.getItem(bucketName) || '[]');
  bucketArray.push({ timestamp, ...values });
  localStorage.setItem(bucketName, JSON.stringify(bucketArray, null, 0));
}

const createStateUpdater = (table, symbol) => event => {
  state[table][symbol] = event.target.value === '' ? null : event.target.valueAsNumber;
  saveState();
};

const numberInput = props => m('input', Object.assign({ type: 'number', step: 0.00001, min: 0 }, props));

const formatUSD = usd =>
  usd.toLocaleString('en', {
    style: 'currency',
    currency: 'usd',
  });

const formatPercentage = (p, d = 0) =>
  p !== 0 && !isNaN(p)
    ? (p + d).toLocaleString('en', {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
    : '∞';

const coinRow = coin => {
  const currentPrice = parseFloat(coin.price_usd);
  const currentHolding = state.holdings[coin.symbol];
  const currentHoldingValue = currentPrice * currentHolding;
  const purchaseValue = (state.purchasePrices[coin.symbol] || 0) * currentHolding;
  if (state.hideNonheld && !(Number.isFinite(currentHolding) && currentHolding > 0)) {
    return null;
  }
  return m('tr', { key: coin.symbol }, [
    m('th.symbol', coin.symbol),
    m('th.name', coin.name),
    m(
      'td.num.current-price',
      currentPrice.toLocaleString('en', {
        style: 'decimal',
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      })
    ),

    m(
      'td.purchase-price',
      numberInput({
        value: state.purchasePrices[coin.symbol],
        oninput: createStateUpdater('purchasePrices', coin.symbol),
      })
    ),
    m('td.holding', numberInput({ value: currentHolding, oninput: createStateUpdater('holdings', coin.symbol) })),
    m('td.num', currentHolding ? formatPercentage(currentHoldingValue / purchaseValue, -1) : null),
    m('td.num', currentHolding ? formatUSD(currentHoldingValue) : null),
    m('td.num', currentHolding ? formatUSD(currentHoldingValue - purchaseValue) : null),
  ]);
};

const coinTable = () =>
  m('table', [
    m('thead', ['Symbol', 'Name', 'USD', 'Avg\u200BPurch\u200B$', 'Holding', '%', '$', 'Δ$'].map(caption => m('th', caption))),
    m('tbody', coins.map(coin => coinRow(coin))),
  ]);

const resultDiv = totals => {
  const { purchaseTotal, currentTotal } = totals;
  if (currentTotal === 0) return;
  const percentageString = formatPercentage(currentTotal / purchaseTotal, -1);
  const usdDeltaString = formatUSD(currentTotal - purchaseTotal);
  const usdString = formatUSD(currentTotal);
  return m('div.inner', m('div.percentage', percentageString), m('div.fiat', usdString), m('div.fiat', 'Δ ' + usdDeltaString));
};

function settingses() {
  return [
    m(
      'button#reload',
      {
        onclick: e => {
          if (e.shiftKey) {
            state.autorefresh = !state.autorefresh;
            return;
          }
          getCoins();
        },
      },
      'Refresh'
    ),
    m('label', [
      m('input', {
        type: 'checkbox',
        checked: state.autorefresh,
        onchange(e) {
          state.autorefresh = e.target.checked;
        },
      }),
      'Autorefresh',
    ]),
    m('label', [
      m('input', {
        type: 'checkbox',
        checked: state.hideNonheld,
        onchange(e) {
          state.hideNonheld = e.target.checked;
        },
      }),
      'Hide Nonheld Coins',
    ]),
  ];
}

const view = () => {
  if (coins === null) return m('div#loading', 'Loading from Coinmarketcap...');
  const totals = calculateTotals(state);
  return m('main', [
    m('div#table', coinTable(state)),
    m('div#result', resultDiv(totals)),
    m('div#settings', settingses()),
  ]);
};

loadState();
m.mount(document.body, { view });
getCoins();
setInterval(() => {
  if (state.autorefresh) {
    getCoins();
  }
}, 120000);
