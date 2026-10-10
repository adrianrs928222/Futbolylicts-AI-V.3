// lib/engine/comboOptimizer.ts

export type MarketPick = {
  id?: string;
  matchId?: string;

  homeTeam?: string;
  awayTeam?: string;

  market: string;
  selection: string;

  odds: number;

  probability?: number;
  confidence?: number;

  value?: number;
};


export type OptimizedPick = MarketPick & {
  marketScore: number;
};


export type ComboResult = {
  picks: OptimizedPick[];
  totalOdds: number;
  confidence: number;
  explanation: string;
};


const MIN_ODDS = 1.25;
const MAX_ODDS = 1.89;



function scoreMarket(
  pick: MarketPick
): number {

  const probability =
    pick.probability ??
    pick.confidence ??
    50;


  const odds = pick.odds;


  // Favorece cuotas con valor
  let oddsValue = 0;


  if (
    odds >= 1.35 &&
    odds <= 1.75
  ) {
    oddsValue = 25;
  }
  else if (
    odds >= 1.25 &&
    odds < 1.35
  ) {
    oddsValue = 10;
  }
  else if (
    odds > 1.75 &&
    odds <= 1.89
  ) {
    oddsValue = 20;
  }


  const probabilityValue =
    probability * 0.7;


  const priceValue =
    Math.log(odds) * 20;


  return (
    probabilityValue +
    oddsValue +
    priceValue +
    (pick.value ?? 0)
  );
}



/**
 * Selecciona el mejor mercado
 * por partido.
 */
function chooseBestMarket(
  picks: MarketPick[]
): OptimizedPick[] {


  const groups =
    new Map<string, MarketPick[]>();


  for (const pick of picks) {


    // FILTRO DURO
    if (
      pick.odds < MIN_ODDS ||
      pick.odds > MAX_ODDS
    ) {
      continue;
    }


    const key =
      pick.matchId ??
      `${pick.homeTeam}-${pick.awayTeam}`;


    if (!groups.has(key)) {
      groups.set(
        key,
        []
      );
    }


    groups
      .get(key)!
      .push(pick);

  }



  const result: OptimizedPick[] = [];



  groups.forEach(
    markets => {


      if (
        markets.length === 0
      ) {
        return;
      }



      markets.sort(
        (a,b) =>
          scoreMarket(b)
          -
          scoreMarket(a)
      );



      const best =
        markets[0];


      result.push({

        ...best,

        marketScore:
          scoreMarket(best)

      });

    }
  );



  return result;

}



/**
 * Construye la combinada final
 */
export function optimizeCombo(

  picks: MarketPick[],

  targetMin = 8,

  targetMax = 10

): ComboResult | null {



  const bestMarkets =
    chooseBestMarket(
      picks
    );



  if (
    bestMarkets.length === 0
  ) {
    return null;
  }



  bestMarkets.sort(
    (a,b) =>
      b.marketScore -
      a.marketScore
  );



  const selected:
    OptimizedPick[] = [];



  let totalOdds = 1;



  for (
    const pick of bestMarkets
  ) {


    if (
      totalOdds >= targetMax
    ) {
      break;
    }



    selected.push(
      pick
    );


    totalOdds *=
      pick.odds;



    if (
      totalOdds >= targetMin &&
      totalOdds <= targetMax
    ) {
      break;
    }

  }



  // Si no llega a cuota,
  // NO mete cuotas basura.
  // Solo añade picks válidos.


  if (
    totalOdds < targetMin
  ) {


    for (
      const pick of bestMarkets
    ) {


      if (
        selected.includes(pick)
      ) {
        continue;
      }



      if (
        totalOdds >= targetMin
      ) {
        break;
      }



      selected.push(
        pick
      );


      totalOdds *=
        pick.odds;

    }

  }



  if (
    selected.length === 0
  ) {
    return null;
  }



  const confidence =
    selected.reduce(
      (sum,p)=>
        sum +
        (
          p.probability ??
          p.confidence ??
          50
        ),
      0
    )
    /
    selected.length;



  return {

    picks:
      selected,


    totalOdds:
      Number(
        totalOdds.toFixed(2)
      ),


    confidence:
      Number(
        confidence.toFixed(1)
      ),


    explanation:
      "Selección basada en mercados con cuota de valor (1.25-1.89). Se descartan cuotas demasiado bajas aunque tengan alta probabilidad."

  };

}