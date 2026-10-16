package com.portfoliolab.backend.research;
import org.junit.jupiter.api.Test;import java.util.*;import static org.junit.jupiter.api.Assertions.*;
class ResearchMathTests {
 @Test void knownSeriesWarmupAndWilderRsi(){var p=ResearchMath.indicators(List.of(1d,2d,3d,4d,5d),3);assertNull(p.get(1).sma());assertEquals(2,p.get(2).sma(),1e-10);assertEquals(3,p.get(3).ema(),1e-10);assertEquals(100,p.get(3).rsi(),1e-10);assertEquals(25,p.get(4).changePct(),1e-10);}
 @Test void flatAndFallingSeries(){var f=ResearchMath.indicators(List.of(2d,2d,2d,2d),3).getLast();assertEquals(50,f.rsi());assertEquals(0,f.realizedVolatility());assertEquals(0,ResearchMath.indicators(List.of(4d,3d,2d,1d),3).getLast().rsi());}
 @Test void drawdownAndCorrelation(){assertEquals(25,ResearchMath.maxDrawdown(List.of(100d,120d,90d,110d)),1e-10);assertNull(ResearchMath.correlation(List.of(1d,2d),List.of(1d,2d)));var series=java.util.stream.IntStream.range(0,25).mapToObj(i->(double)i).toList();assertEquals(1,ResearchMath.correlation(series,series),1e-10);assertNull(ResearchMath.correlation(Collections.nCopies(25,1d),series));}
 @Test void knownWilderWorksheetAndLogReturnVolatility(){var prices=List.of(44.34d,44.09d,44.15d,43.61d,44.33d,44.83d,45.10d,45.42d,45.84d,46.08d,45.89d,46.03d,45.61d,46.28d,46.28d);assertEquals(70.46413502109705,ResearchMath.indicators(prices,14).getLast().rsi(),1e-8);assertEquals(Math.log(2)/Math.sqrt(2)*Math.sqrt(365)*100,ResearchMath.indicators(List.of(1d,2d,8d),2).getLast().realizedVolatility(),1e-8);}
 @Test void invalidInputs(){assertThrows(IllegalArgumentException.class,()->ResearchMath.indicators(List.of(0d),3));assertThrows(IllegalArgumentException.class,()->ResearchMath.indicators(List.of(1d),1));}
}
