const https = require("https");

function getJSON(url, headers={}) {
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{headers},res=>{
      let body="";
      res.on("data",d=>body+=d);
      res.on("end",()=>{
        if(res.statusCode<200||res.statusCode>=300) return reject(new Error(`HTTP ${res.statusCode}`));
        try{resolve(JSON.parse(body))}catch(e){reject(e)}
      });
    });
    req.setTimeout(9000,()=>req.destroy(new Error("timeout")));
    req.on("error",reject);
  });
}
function normalizeResult(q){
  const symbol=q.symbol||"";
  const name=q.longname||q.shortname||q.name||symbol;
  const exchange=q.exchDisp||q.exchange||"";
  const type=q.typeDisp||q.quoteType||"";
  return {symbol,name,exchange,type};
}
exports.handler=async(event)=>{
  const q=(event.queryStringParameters?.q||"").trim();
  if(!q)return {statusCode:400,headers:{"content-type":"application/json; charset=utf-8"},body:JSON.stringify({error:"검색어를 입력해 주세요."})};
  try{
    const hosts=["query1.finance.yahoo.com","query2.finance.yahoo.com"];
    let data=null,err=null;
    for(const h of hosts){
      try{
        const url=`https://${h}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query`;
        data=await getJSON(url,{"User-Agent":"Mozilla/5.0","Accept":"application/json","Accept-Language":"ko-KR,ko;q=0.9,en-US;q=0.8"});
        if(data)break;
      }catch(e){err=e}
    }
    if(!data)throw err||new Error("search failed");
    let results=(data.quotes||[])
      .filter(x=>x.symbol && !["CRYPTOCURRENCY","FUTURE"].includes(x.quoteType))
      .map(normalizeResult)
      .slice(0,12);
    return {statusCode:200,headers:{"content-type":"application/json; charset=utf-8","cache-control":"public,max-age=60"},body:JSON.stringify({results})};
  }catch(e){
    return {statusCode:502,headers:{"content-type":"application/json; charset=utf-8"},body:JSON.stringify({error:"종목 검색 서버 연결에 실패했습니다.",detail:e.message})};
  }
};