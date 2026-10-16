package com.portfoliolab.backend.oms;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
public final class OrderConditions {
 private OrderConditions() {}
 public static void validate(String kind,BigDecimal limit,String tif) {
  if(!List.of("MARKET","LIMIT").contains(kind)||!List.of("DAY","GTC").contains(tif)||
    (kind.equals("MARKET") && limit!=null)|| (kind.equals("LIMIT") && (limit==null||limit.signum()<=0||limit.scale()>4||limit.precision()>19)))
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid order type, limit price or time in force");
 }
 // Continuous fictional market: DAY ends at midnight in the demo's India timezone.
 public static Instant expiration(String tif,Instant now) {
  return tif.equals("DAY")?now.atZone(ZoneId.of("Asia/Kolkata")).toLocalDate().plusDays(1).atStartOfDay(ZoneId.of("Asia/Kolkata")).toInstant():null;
 }
 public static boolean eligible(String side,BigDecimal limit,BigDecimal price) {
  return limit==null || (side.equals("BUY")?price.compareTo(limit)<=0:price.compareTo(limit)>=0);
 }
 public static class PriceNotEligible extends ResponseStatusException {
  public PriceNotEligible(){super(HttpStatus.CONFLICT,"Limit price is not currently executable");}
 }
}
