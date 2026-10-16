package com.portfoliolab.backend.oms;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;
class OrderConditionsTests {
 @Test void crossingAndEveryPartialFill() {
  var limit=new BigDecimal("100");
  assertFalse(OrderConditions.eligible("BUY",limit,new BigDecimal("101")));
  assertTrue(OrderConditions.eligible("BUY",limit,new BigDecimal("100")));
  assertTrue(OrderConditions.eligible("BUY",limit,new BigDecimal("99")));
  assertFalse(OrderConditions.eligible("BUY",limit,new BigDecimal("102")));
  assertFalse(OrderConditions.eligible("SELL",limit,new BigDecimal("99")));
  assertTrue(OrderConditions.eligible("SELL",limit,new BigDecimal("101")));
 }
 @Test void dayExpiresAtIndiaMidnightAndGtcDoesNot() {
  var now=Instant.parse("2026-10-16T10:00:00Z");
  assertEquals(Instant.parse("2026-10-16T18:30:00Z"),OrderConditions.expiration("DAY",now));
  assertNull(OrderConditions.expiration("GTC",now));
 }
 @Test void invalidPricesAndTypesRejected() {
  assertThrows(RuntimeException.class,()->OrderConditions.validate("LIMIT",BigDecimal.ZERO,"DAY"));
  assertThrows(RuntimeException.class,()->OrderConditions.validate("LIMIT",null,"GTC"));
  assertThrows(RuntimeException.class,()->OrderConditions.validate("MARKET",BigDecimal.ONE,"GTC"));
  assertThrows(RuntimeException.class,()->OrderConditions.validate("LIMIT",BigDecimal.ONE,"IOC"));
 }
}
