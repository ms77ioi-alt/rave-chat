const https = require("https");
const ALLOWED=new Set(["1mo","3mo","6mo","1y","2y","5y"]);

function getJSON(url,headers={}){
 return new Promise((resolve,reject)=>{
  const req=https.get(url,{headers},res=>{
   let body="";res.on("data",d=>body+=d);res.on("end",()=>{if(res.statusCode<200||res.statusCode>=300)return reject(new Error(`HTTP ${res.statusCode}`));try{resolve(JSON.parse(body))}catch(e){reject(e)}});
  });req.setTimeout(9000,()=>req.destroy(new Error("timeout")));req.on("error",reject);
 });
}
exports.handler=async(event)=>{
 const symbol=String(event.queryStringParameters?.symbol||"").trim().toUpperCase();
 const range=ALLOWED.has(event.queryStringParameters?.range)?event.queryStringParameters.range:"3mo";
 if(!symbol)return {statusCode:400,headers:{"content-type":"application/json; charset=utf-8"},body:JSON.stringify({error:"종목 티커가 없습니다."})};
 let data=null,lastErr=null;
 for(const host of ["query1.finance.yahoo.com","query2.finance.yahoo.com"]){
  try{
   const url=`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includePrePost=false&events=div%2Csplits`;
   data=await getJSON(url,{"User-Agent":"Mozilla/5.0","Accept":"application/json","Accept-Language":"ko-KR,ko;q=0.9,en-US;q=0.8"});
   if(data?.chart?.result?.[0])break;
  }catch(e){lastErr=e}
 }
 if(!data?.chart?.result?.[0])return {statusCode:502,headers:{"content-type":"application/json; charset=utf-8"},body:JSON.stringify({error:"시세를 불러오지 못했습니다.",detail:lastErr?.message||""})};
 const r=data.chart.result[0],m=r.meta||{},q=r.indicators?.quote?.[0]||{},ts=r.timestamp||[],rows=[];
 for(let i=0;i<ts.length;i++){
  const o=q.open?.[i],h=q.high?.[i],l=q.low?.[i],c=q.close?.[i],v=q.volume?.[i];
  if(![o,h,l,c].every(Number.isFinite))continue;
  rows.push({time:ts[i],open:o,high:h,low:l,close:c,volume:Number.isFinite(v)?v:0});
 }
 if(rows.length<2)return {statusCode:404,headers:{"content-type":"application/json; charset=utf-8"},body:JSON.stringify({error:"일봉 데이터를 찾지 못했습니다."})};
 return {statusCode:200,headers:{"content-type":"application/json; charset=utf-8","cache-control":"public,max-age=120,stale-while-revalidate=300"},body:JSON.stringify({
  meta:{symbol:m.symbol||symbol,currency:m.currency||"",exchangeName:m.exchangeName||"",fullExchangeName:m.fullExchangeName||"",shortName:m.shortName||"",longName:m.longName||m.shortName||"",timezone:m.exchangeTimezoneName||""},rows
 })};
};