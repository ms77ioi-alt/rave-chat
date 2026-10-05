const https = require("https");

const US_KO_ALIASES = {
  "트랜스오션":"RIG","나이키":"NKE","애플":"AAPL","마이크로소프트":"MSFT","마소":"MSFT",
  "테슬라":"TSLA","엔비디아":"NVDA","아마존":"AMZN","메타":"META","페이스북":"META",
  "구글":"GOOGL","알파벳":"GOOGL","버라이즌":"VZ","리얼티인컴":"O","브리스톨마이어스스큅":"BMY",
  "브리스톨 마이어스 스큅":"BMY","레드와이어":"RDW","이오밴스":"IOVA","웬디스":"WEN",
  "할로자임":"HALO","앱셀레라":"ABCL","젠맙":"GMAB","슈드":"SCHD","슈드 etf":"SCHD"
};

function getText(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}`));
        resolve(body);
      });
    });
    req.setTimeout(9000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function getJSON(url, headers = {}) {
  return JSON.parse(await getText(url, headers));
}

const HDR = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  "Accept": "application/json,text/plain,*/*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
};

function isHangul(s) { return /[가-힣]/.test(s); }
function cleanKey(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }
function marketSuffix(item) {
  const t = `${item.typeName || ""} ${item.typeCode || ""} ${item.market || ""}`.toUpperCase();
  if (t.includes("KOSDAQ") || t.includes("코스닥")) return ".KQ";
  if (t.includes("KOSPI") || t.includes("코스피")) return ".KS";
  return "";
}
function naverItemToResult(item) {
  const code = String(item.code || item.itemCode || "").trim();
  if (!/^\d{6}$/.test(code)) return null;
  let symbol = String(item.reutersCode || item.symbol || "").trim().toUpperCase();
  if (!/^\d{6}\.(KS|KQ)$/.test(symbol)) symbol = code + marketSuffix(item);
  if (!/^\d{6}\.(KS|KQ)$/.test(symbol)) symbol = code + ".KS";
  return {
    symbol,
    name: item.name || item.stockName || code,
    exchange: item.typeName || item.market || item.typeCode || "한국",
    type: item.typeName || "주식"
  };
}

function parseNaverModern(data) {
  const items = data?.result?.items || data?.items || [];
  if (!Array.isArray(items)) return [];
  return items.map(naverItemToResult).filter(Boolean);
}

function parseNaverLegacy(data) {
  let groups = data?.items || [];
  if (!Array.isArray(groups)) return [];
  const flat = Array.isArray(groups[0]) && Array.isArray(groups[0][0]) ? groups.flat() : groups;
  const out = [];
  for (const x of flat) {
    if (!Array.isArray(x)) continue;
    const name = x[0], code = String(x[1] || "");
    if (!/^\d{6}$/.test(code)) continue;
    const joined = x.join(" ");
    const suffix = /KOSDAQ|코스닥/i.test(joined) ? ".KQ" : ".KS";
    out.push({ symbol: code + suffix, name: name || code, exchange: suffix === ".KQ" ? "KOSDAQ" : "KOSPI", type: "주식" });
  }
  return out;
}

async function searchNaver(q) {
  const urls = [
    `https://m.stock.naver.com/front-api/search/autoComplete?query=${encodeURIComponent(q)}&target=stock,index,marketindicator,coin,ipo`,
    `https://ac.finance.naver.com/ac?q=${encodeURIComponent(q)}&q_enc=UTF-8&st=111&sug=all&frm=stock`
  ];
  for (let i = 0; i < urls.length; i++) {
    try {
      const data = await getJSON(urls[i], { ...HDR, "Referer": "https://finance.naver.com/" });
      const results = i === 0 ? parseNaverModern(data) : parseNaverLegacy(data);
      if (results.length) return results.slice(0, 12);
    } catch (_) {}
  }
  return [];
}

function normalizeYahoo(x) {
  return {
    symbol: x.symbol || "",
    name: x.longname || x.shortname || x.name || x.symbol || "",
    exchange: x.exchDisp || x.exchange || "",
    type: x.typeDisp || x.quoteType || ""
  };
}

async function searchYahoo(q) {
  let lastErr = null;
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const url = `https://${host}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0`;
      const data = await getJSON(url, HDR);
      const results = (data.quotes || [])
        .filter(x => x.symbol && !["CRYPTOCURRENCY", "FUTURE"].includes(x.quoteType))
        .map(normalizeYahoo)
        .slice(0, 12);
      if (results.length) return results;
    } catch (e) { lastErr = e; }
  }
  if (lastErr) throw lastErr;
  return [];
}

exports.handler = async (event) => {
  const q = String(event.queryStringParameters?.q || "").trim();
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "public,max-age=60" };
  if (!q) return { statusCode: 400, headers, body: JSON.stringify({ error: "검색어를 입력해 주세요." }) };

  try {
    // 국내 종목명/6자리 코드는 네이버 자동완성으로 먼저 해결 → 전체 국내 종목명 검색 범위를 넓힘.
    if (isHangul(q) || /^\d{6}$/.test(q)) {
      const domestic = await searchNaver(q);
      if (domestic.length) return { statusCode: 200, headers, body: JSON.stringify({ results: domestic }) };
    }

    // 미국 종목의 자주 쓰는 한글 별칭.
    const alias = US_KO_ALIASES[cleanKey(q)];
    if (alias) {
      const us = await searchYahoo(alias);
      if (us.length) return { statusCode: 200, headers, body: JSON.stringify({ results: us }) };
    }

    // 영문 회사명, 티커, ETF, 숫자코드 등은 Yahoo 검색.
    const yahoo = await searchYahoo(q);
    if (yahoo.length) return { statusCode: 200, headers, body: JSON.stringify({ results: yahoo }) };

    return { statusCode: 200, headers, body: JSON.stringify({ results: [] }) };
  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: "종목 검색 서버 연결에 실패했습니다.", detail: e.message }) };
  }
};
