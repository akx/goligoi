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
      for (let o = 0; 15 > o; o++) l & (1 << o) && t.fillRect(e + (o % 3), n + (0 | (o / 3)), 1, 1);
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
  const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
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
      saveTimeSeriesValues({
        currentTotal: Math.round(totals.currentTotal || 0),
        purchaseTotal: Math.round(totals.purchaseTotal || 0),
      });
    });
}

const state = {
  purchasePrices: {},
  holdings: {},
  autorefresh: false,
  showChart: true,
  showSidebar: true,
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

function aop(arr) {
  const keys = {};
  let nKeys = 0;
  const out = [];
  arr.forEach(obj => {
    const outObj = {};
    Object.keys(obj).forEach(key => {
      if (key === 'undefined') return;
      if (!keys[key]) keys[key] = ++nKeys;
      outObj[keys[key]] = obj[key];
    });
    if (Object.keys(outObj).length) {
      out.push(outObj);
    }
  });
  return { $aop: keys, $data: out };
}

function deaop(aoped) {
  if (!aoped.$aop) return aoped;
  const keys = {};
  Object.keys(aoped.$aop).forEach(key => {
    keys[aoped.$aop[key]] = key;
  });
  return aoped.$data
    .map(obj => {
      const outObj = {};
      Object.keys(obj).forEach(key => {
        outObj[keys[key]] = obj[key];
      });
      return outObj;
    })
    .filter(obj => '' + obj !== '{}');
}

function saveTimeSeriesValues(values) {
  const timestamp = Math.round(+new Date() / 1000);
  const bucketId = Math.floor(timestamp / 86400)
    .toString(16)
    .padStart(5, '0');
  const bucketName = `goligoi-ts-${bucketId}`;
  const storageValue = JSON.parse(localStorage.getItem(bucketName) || '[]');
  const bucketArray = deaop(storageValue);
  const newDatum = Object.assign({ timestamp }, values);
  bucketArray.push(newDatum);
  const compressedArray = aop(bucketArray);
  try {
    localStorage.setItem(bucketName, JSON.stringify(compressedArray, null, 0));
  } catch (err) {
    console.warn('Time series data error:', err);
    if (err.toString().indexOf('quota') > -1) {
      cleanTimeSeriesData(1);
    }
  }
}

function cleanTimeSeriesData(limit = 0) {
  let keys = [];
  for (var key in localStorage) {
    if (/^goligoi-ts-.+/.test(key)) {
      keys.push(key);
    }
  }
  keys.sort();
  for (var i = 0; i < limit; i++) {
    if (!keys.length) {
      break;
    }
    var key = keys.shift();
    localStorage.removeItem(key);
    console.log('Removed time storage key ' + key);
  }
}

function loadTimeSeriesData() {
  let items = [];
  for (var key in localStorage) {
    if (/^goligoi-ts-.+/.test(key)) {
      items = items.concat(deaop(JSON.parse(localStorage[key])));
    }
  }
  items = items.filter(e => e.timestamp);
  items.sort((a, b) => a.timestamp - b.timestamp);
  return items;
}

function generateTimeSeriesSVG() {
  const allData = loadTimeSeriesData();
  const data = allData.slice(allData.length - 1000);
  if (!data.length) return null;
  let minTimestamp = data[0].timestamp,
    maxTimestamp = data[0].timestamp;
  let minValue = data[0].currentTotal,
    maxValue = data[0].currentTotal;
  data.forEach(({ timestamp, currentTotal }) => {
    if (!isNaN(currentTotal)) {
      minValue = Math.min(minValue, currentTotal);
      maxValue = Math.max(maxValue, currentTotal);
    }
    if (!isNaN(timestamp)) {
      minTimestamp = Math.min(minTimestamp, timestamp);
      maxTimestamp = Math.max(maxTimestamp, timestamp);
    }
  });
  const points = data
    .map(({ timestamp, currentTotal }) => {
      if (isNaN(timestamp) || isNaN(currentTotal)) return null;
      const x = ((timestamp - minTimestamp) / (maxTimestamp - minTimestamp)) * 1000;
      const y = (1 - (currentTotal - minValue) / (maxValue - minValue)) * 1000;
      return { x, y };
    })
    .filter(v => v);
  const svg = m(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '1000',
      height: '1000',
    },
    m('polyline', {
      stroke: 'white',
      fill: 'none',
      opacity: '0.4',
      points: points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    })
  );
  const frag = document.createDocumentFragment();
  m.render(frag, svg);
  return 'data:image/svg+xml,' + encodeURIComponent('<?xml version="1.0" encoding="UTF-8" standalone="no"?>' + frag.firstChild.outerHTML);
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

const formatPercentage = (p, d = 0) => {
  if (p !== 0 && !isNaN(p)) {
    return (p + d).toLocaleString('en', {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  return '∞';
};

const coinRow = coin => {
  const currentPrice = parseFloat(coin.price_usd);
  const currentHolding = state.holdings[coin.symbol];
  const currentHoldingValue = currentPrice * currentHolding;
  const purchaseValue = (state.purchasePrices[coin.symbol] || 0) * currentHolding;
  if (state.hideNonheld && !(Number.isFinite(currentHolding) && currentHolding > 0)) {
    return null;
  }
  return m('tr', { key: coin.symbol }, [
    m('th.symbol', m('a', { href: `http://coinmarketcap.com/currencies/${coin.id}` }, coin.symbol)),
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
    m(
      'td.holding',
      numberInput({
        value: currentHolding,
        oninput: createStateUpdater('holdings', coin.symbol),
      })
    ),
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
  return m('div.inner', [m('div.percentage', percentageString), m('div.fiat', usdString), m('div.fiat', 'Δ ' + usdDeltaString)]);
};

function checkbox(label, stateField) {
  return m('label', [
    m('input', {
      type: 'checkbox',
      checked: state[stateField],
      onchange(e) {
        state[stateField] = e.target.checked;
      },
    }),
    label,
  ]);
}

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
    checkbox('Autorefresh', 'autorefresh'),
    checkbox('Hide Nonheld Coins', 'hideNonheld'),
    checkbox('Show Chart', 'showChart'),
    checkbox('Show Sidebar', 'showSidebar'),
  ];
}

const view = () => {
  if (coins === null) return m('div#loading', 'Loading from Coinmarketcap...');
  const totals = calculateTotals(state);
  return m('main' + (state.showSidebar ? '.sidebar-visible' : ''), [
    m('div#table', coinTable(state)),
    m(
      'div#result',
      {
        style: state.showChart ? `background-image: url(${generateTimeSeriesSVG()}` : '',
      },
      resultDiv(totals)
    ),
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
