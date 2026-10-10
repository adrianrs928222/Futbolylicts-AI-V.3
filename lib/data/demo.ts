import type { EnrichedFixture, TeamForm } from "@/lib/engine/types";
const form = (ppg:number,gf:number,ga:number,btts:number,o25:number):TeamForm=>({matches:8,wins:4,draws:2,losses:2,goalsForPerGame:gf,goalsAgainstPerGame:ga,scoringPct:.82,concededPct:.68,over15Pct:.78,over25Pct:o25,bttsPct:btts,cleanSheetPct:.25,pointsPerGame:ppg});
export function demoFixtures(date:string):EnrichedFixture[]{
  const base=Math.floor(new Date(`${date}T15:00:00+02:00`).getTime()/1000);
  return [
    {id:900001,home:"Atlético Azul",away:"Real Verde",league:"La Liga",country:"Spain"},
    {id:900002,home:"United City",away:"Rovers",league:"Premier League",country:"England"},
    {id:900003,home:"FC Nord",away:"Borussia Süd",league:"Bundesliga",country:"Germany"},
    {id:900004,home:"Olympique A",away:"Racing B",league:"Ligue 1",country:"France"},
    {id:900005,home:"Sporting Alfa",away:"Calcio Beta",league:"Serie A",country:"Italy"},
  ].map((x,i)=>({fixture:{id:x.id,date:new Date((base+i*3600)*1000).toISOString(),timestamp:base+i*3600,status:"NS",round:"Jornada demo",league:{id:100+i,name:x.league,country:x.country,season:2026},home:{id:1000+i*2,name:x.home},away:{id:1001+i*2,name:x.away}},category:"top_league",homeForm:form(1.9,1.8,1.1,.62,.62),awayForm:form(1.55,1.5,1.35,.66,.58),standings:{homeRank:4,awayRank:8,teamsInLeague:20},odds:[
    {market:"OVER_2_5",label:"Más de 2.5 goles",decimal:1.48,bookmaker:"Demo",real:true},
    {market:"BTTS_YES",label:"Ambos marcan: Sí",decimal:1.52,bookmaker:"Demo",real:true},
    {market:"DOUBLE_CHANCE_1X",label:`${x.home} o empate (1X)`,decimal:1.35,bookmaker:"Demo",real:true},
  ]})) as EnrichedFixture[];
}
