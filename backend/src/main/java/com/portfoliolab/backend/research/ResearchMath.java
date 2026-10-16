package com.portfoliolab.backend.research;
import java.util.*;
public final class ResearchMath {
 private ResearchMath(){}
 public record Point(Double sma,Double ema,Double rsi,Double realizedVolatility,Double change,Double changePct){}
 public static List<Point> indicators(List<Double> prices,int period){
  if(period<2||period>100)throw new IllegalArgumentException("period must be 2..100");
  List<Point> out=new ArrayList<>();Double ema=null;double gain=0,loss=0;
  for(int i=0;i<prices.size();i++){
   double p=prices.get(i);if(!Double.isFinite(p)||p<=0)throw new IllegalArgumentException("positive finite prices required");
   Double sma=null,rsi=null,vol=null,delta=i==0?null:p-prices.get(i-1),pct=i==0?null:delta/prices.get(i-1)*100;
   if(i>=period-1){double sum=0;for(int j=i-period+1;j<=i;j++)sum+=prices.get(j);sma=sum/period;ema=ema==null?sma:ema+(p-ema)*2/(period+1);}
   if(i>0){double d=delta;if(i<=period){gain+=Math.max(d,0)/period;loss+=Math.max(-d,0)/period;}else{gain=(gain*(period-1)+Math.max(d,0))/period;loss=(loss*(period-1)+Math.max(-d,0))/period;}}
   if(i>=period){rsi=loss==0?(gain==0?50.0:100.0):100-100/(1+gain/loss);List<Double> returns=new ArrayList<>();for(int j=i-period+1;j<=i;j++)returns.add(Math.log(prices.get(j)/prices.get(j-1)));vol=standardDeviation(returns)*Math.sqrt(365)*100;}
   out.add(new Point(sma,ema,rsi,vol,delta,pct));
  }return out;
 }
 public static double standardDeviation(List<Double> x){if(x.size()<2)throw new IllegalArgumentException("insufficient returns");double mean=x.stream().mapToDouble(v->v).average().orElseThrow();return Math.sqrt(x.stream().mapToDouble(v->(v-mean)*(v-mean)).sum()/(x.size()-1));}
 public static Double correlation(List<Double>a,List<Double>b){if(a.size()!=b.size()||a.size()<20)return null;double ma=a.stream().mapToDouble(v->v).average().orElseThrow(),mb=b.stream().mapToDouble(v->v).average().orElseThrow(),sum=0,aa=0,bb=0;for(int i=0;i<a.size();i++){double x=a.get(i)-ma,y=b.get(i)-mb;sum+=x*y;aa+=x*x;bb+=y*y;}return aa==0||bb==0?null:Math.max(-1,Math.min(1,sum/Math.sqrt(aa*bb)));}
 public static double maxDrawdown(List<Double> values){double peak=0,max=0;for(double v:values){peak=Math.max(peak,v);if(peak>0)max=Math.max(max,(peak-v)/peak);}return max*100;}
}
