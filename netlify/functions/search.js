const https=require("https");

const STATIC={
 "삼성전자":{symbol:"005930.KS",name:"삼성전자",exchange:"KOSPI",type:"주식"},
 "삼성전자우":{symbol:"005935.KS",name:"삼성전자우",exchange:"KOSPI",type:"주식"},
 "sk하이닉스":{symbol:"000660.KS",name:"SK하이닉스",exchange:"KOSPI",type:"주식"},
 "현대차":{symbol:"005380.KS",name:"현대차",exchange:"KOSPI",type:"주식"},
 "한화오션":{symbol:"042660.KS",name:"한화오션",exchange:"KOSPI",type:"주식"},
 "금강공업":{symbol:"014280.KS",name:"금강공업",exchange:"KOSPI",type:"주식"},
 "schd":{symbol:"SCHD",name:"Schwab US Dividend Equity ETF",exchange:"NYSEArca",type:"ETF"},
 "슈드":{symbol:"SCHD",name:"Schwab US Dividend Equity ETF",exchange:"NYSEArca",type:"ETF"},
 "rig":{symbol:"RIG",name:"Transocean",exchange:"NYSE",type:"Equity"},
 "트랜스오션":{symbol:"RIG",name:"Transocean",exchange:"NYSE",type:"Equity"},
 "nke":{symbol:"NKE",name:"Nike",exchange:"NYSE",type:"Equity"},
 "나이키":{symbol:"NKE",name:"Nike",exchange:"NYSE",type:"Equity"},
 "qndx":{symbol:"QNDX",name:"Nasdaq 100 Daily 2x",exchange:"NASDAQ",type:"ETF"},
 "schg":{symbol:"SCHG",name:"Schwab US Large-Cap Growth ETF",exchange:"NYSEArca",type:"ETF"},
 "qqqm":{symbol:"QQQM",name:"Invesco NASDAQ 100 ETF",exchange:"NASDAQ",type:"ETF"},
 "gpiq":{symbol:"GPIQ",name:"Goldman Sachs Nasdaq-100 Premium Income ETF",exchange:"NASDAQ",type:"ETF"}
};

function key(s){return String(s||"").trim().toLowerCase().replace(/\s+/g,"")}
function getJSON(url){
 return new Promise((resolve,reject)=>{
  const req=https.get(url,{headers:{"User-Agent":"Mozilla/5.0","Accept":"application/json","Accept-Language":"ko-KR,ko;q=0.9,en-US;q=0.8"}},res=>{
   let body="";
   res.on("data",d=>body+=d);
   res.on("end",()=>{
    if(res.statusCode<200||res.statusCode>=300)return reject(new Error(`HTTP ${res.statusCode}`));
    try{resolve(JSON.parse(body))}catch(e){reject(e)}
   });
  });
  req.setTimeout(9000,()=>req.destroy(new Error("timeout")));
  req.on("error",reject);
 });
}
function normalize(q){return{symbol:q.symbol||"",name:q.longname||q.shortname||q.name||q.symbol||"",exchange:q.exchDisp||q.exchange||"",type:q.typeDisp||q.quoteType||""}}

exports.handler=async(event)=>{
 const q=(event.queryStringParameters?.q||"").trim();
 if(!q)return{statusCode:400,headers:{"content-type":"application/json; charset=utf-8"},body:JSON.stringify({error:"검색어를 입력해 주세요."})};

 const k=key(q);
 if(STATIC[k])return{statusCode:200,headers:{"content-type":"application/json; charset=utf-8"},body:JSON.stringify({results:[STATIC[k]]})};

 if(/^[A-Za-z][A-Za-z0-9.^-]{0,14}$/.test(q)){
   const s=q.toUpperCase();
   return{statusCode:200,headers:{"content-type":"application/json; charset=utf-8"},body:JSON.stringify({results:[{symbol:s,name:s,exchange:"",type:"티커 직접 검색"}]})};
 }

 try{
  let data=null,err=null;
  for(const h of ["query1.finance.yahoo.com","query2.finance.yahoo.com"]){
   try{
    data=await getJSON(`https://${h}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0`);
    if(data)break;
   }catch(e){err=e}
  }
  if(!data)throw err||new Error("search failed");
  const results=(data.quotes||[]).filter(x=>x.symbol&&!["CRYPTOCURRENCY","FUTURE"].includes(x.quoteType)).map(normalize).slice(0,12);
  return{statusCode:200,headers:{"content-type":"application/json; charset=utf-8"},body:JSON.stringify({results})};
 }catch(e){
  return{statusCode:502,headers:{"content-type":"application/json; charset=utf-8"},body:JSON.stringify({error:"종목 검색 서버 연결에 실패했습니다.",detail:e.message})};
 }
};
