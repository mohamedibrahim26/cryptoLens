# CryptoLens - Live Crypto Price Tracker

A live cryptocurrency tracker that pulls real data from the CoinGecko public API. You can track prices, view charts, build a portfolio, and save a watchlist. Built using plain HTML, CSS, and JavaScript. No frameworks.

Live demo: https://mohamedibrahim26.github.io/cryptolens

---

## What it does

**Live prices**
- Loads the top 50 coins by market cap from CoinGecko
- Prices auto-refresh every 60 seconds
- A circular countdown ring shows when the next refresh happens
- You can also click the ring to refresh manually
- When prices change, cards flash green or red briefly

**Ticker bar**
- A scrolling ticker at the top shows live prices for the top 20 coins
- It pauses when you hover over it

**Market stats**
- Shows global market cap, 24h trading volume, BTC dominance and ETH dominance at the top

**Coin cards**
- Each card has the current price, 24h percentage change, market cap, volume, and a 7-day sparkline chart
- The sparkline is built manually using SVG paths, no charting library needed for that part
- Hovering a card lifts it with a subtle glow

**Search**
- The search bar filters coins as you type
- A dropdown shows matching results with prices so you can jump straight to a coin

**Filters and sorting**
- Filter tabs let you switch between All, Top Gainers, Top Losers, and your Watchlist
- You can also sort by price, 24h change, market cap or volume

**Watchlist**
- Click the star on any card to save it to your watchlist
- Watchlist saves in localStorage so it stays after you close the tab

**Portfolio calculator**
- Open any coin and enter how much you hold
- The portfolio panel shows your total value and 24h profit or loss across all holdings
- Everything saves to localStorage

**Coin detail chart**
- Clicking any card opens a modal with a full price chart powered by Chart.js
- You can switch between 1D, 7D, 1M and 1Y timeframes
- The chart colour changes based on whether the coin is up or down

---

## File structure

```
CryptoLens/
├── index.html    - page layout and all the HTML
├── styles.css    - dark theme, animations, card styles, responsive layout
└── script.js     - API calls, chart logic, portfolio, search, filters
```

---

## Tech used

- HTML5
- CSS3 (custom properties, keyframes, flexbox, grid)
- Vanilla JavaScript (ES6+, async/await)
- CoinGecko public API (no API key needed)
- Chart.js (CDN) for the modal price chart
- localStorage for watchlist and portfolio
- Google Fonts (Space Grotesk, Space Mono)
- Hosted on GitHub Pages

---

## Running it locally

```bash
git clone https://github.com/mohamedibrahim26/cryptolens.git
cd cryptolens
```

Open `index.html` in your browser. It will fetch live data automatically on load.

One thing to know: the CoinGecko free API has rate limits. If you refresh too many times quickly, it may temporarily return an error. The app handles that and shows a retry button instead of just breaking.

---

## Things I learnt

Working with a real API taught me a lot about things I had skipped over before. Handling rate limit errors, showing proper loading states, and making sure the app doesn't just crash silently when a fetch fails took more thought than I expected.

Drawing the sparklines manually with SVG was something I hadn't done before. I had to figure out how to scale price data into pixel coordinates. It is not that complicated once you understand the math, but it took me a bit to get the path looking clean.

The Chart.js integration was straightforward for basic usage, but customising the tooltip style, axis colours and gradient fill to match the dark theme needed some digging through their docs.

Getting the portfolio PnL to update correctly when prices refresh was also a good exercise in keeping state consistent across the page.

---

## About

CryptoLens is a frontend-only crypto price tracker built without any frameworks. It uses the CoinGecko public API to pull live market data and lets you track prices, build a personal portfolio, and filter coins by performance. The project was built to practise async JavaScript, API integration, and data visualisation using plain web technologies.
