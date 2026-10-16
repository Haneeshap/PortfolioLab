package com.portfoliolab.backend.oms;
import com.portfoliolab.backend.portfolio.*;
import com.portfoliolab.backend.asset.*;
import com.portfoliolab.backend.risk.PreTradeRiskService;
import java.math.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
@Service
public class OrderReservations {
 private final JdbcTemplate jdbc;
 private final PortfolioRepository portfolios;
 private final AssetRepository assets;
 private final OrderPricingService pricing;
 private final PreTradeRiskService risk;
 public OrderReservations(JdbcTemplate jdbc,PortfolioRepository portfolios,AssetRepository assets,OrderPricingService pricing,PreTradeRiskService risk) {
  this.jdbc=jdbc;this.portfolios=portfolios;this.assets=assets;this.pricing=pricing;this.risk=risk;
 }
 public void lock(long portfolioId) {
  if(jdbc.queryForList("SELECT id FROM portfolios WHERE id=? FOR UPDATE",portfolioId).isEmpty())
   throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Portfolio not found");
 }
 public BigDecimal cash(long portfolioId,long except) {
  return jdbc.queryForObject("SELECT COALESCE(SUM(reserved_cash),0) FROM simulated_orders WHERE portfolio_id=? AND id<>?",BigDecimal.class,portfolioId,except);
 }
 public BigDecimal shares(long portfolioId,long assetId,long except) {
  return jdbc.queryForObject("SELECT COALESCE(SUM(reserved_shares),0) FROM simulated_orders WHERE portfolio_id=? AND asset_id=? AND id<>?",BigDecimal.class,portfolioId,assetId,except);
 }
 public void enforce(Portfolio portfolio,Asset asset,String side,BigDecimal qty,BigDecimal amount,long except) {
  if(side.equals("BUY") && portfolio.getCashBalance().subtract(cash(portfolio.getId(),except)).compareTo(amount)<0)
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Insufficient available buying power");
  if(side.equals("SELL")) {
   BigDecimal held=jdbc.queryForObject("SELECT COALESCE(SUM(quantity),0) FROM holdings WHERE portfolio_id=? AND asset_id=?",BigDecimal.class,portfolio.getId(),asset.getId());
   if(held.subtract(shares(portfolio.getId(),asset.getId(),except)).compareTo(qty)<0)
    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Insufficient available shares");
  }
 }
 public static BigDecimal reservationUnit(OrderRequest request,OrderPricingService.Pricing quote) {
  return (request.limitPrice()==null?quote.price():request.limitPrice()).multiply(quote.fxRate()).multiply(new BigDecimal("1.05")).setScale(4,RoundingMode.CEILING);
 }
 public void reserve(long id,long portfolioId,OrderRequest request) {
  // Caller holds portfolio lock before touching order rows. Settlement uses the same lock.
  Portfolio portfolio=portfolios.findByIdForUpdate(portfolioId).orElseThrow();
  Asset asset=assets.findById(request.assetId()).orElseThrow();
  var quote=pricing.calculate(asset,portfolio,request.quantity());
  BigDecimal unit=reservationUnit(request,quote);
  BigDecimal amount=unit.multiply(request.quantity());
  if(unit.precision()>19||amount.precision()>19)
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Reservation exceeds supported precision");
  String side=request.type().trim().toUpperCase(Locale.ROOT);
  risk.enforce(portfolio,asset,side,request.quantity(),request.limitPrice()==null?quote.portfolioTotal():request.limitPrice().multiply(quote.fxRate()).multiply(request.quantity()));
  enforce(portfolio,asset,side,request.quantity(),amount,id);
  jdbc.update("UPDATE simulated_orders SET reservation_managed=TRUE,reserved_cash=?,reserved_shares=?,cash_per_share=? WHERE id=?",
   side.equals("BUY")?amount:BigDecimal.ZERO,side.equals("SELL")?request.quantity():BigDecimal.ZERO,side.equals("BUY")?unit:BigDecimal.ZERO,id);
 }
 public void remaining(long id,BigDecimal qty) {
  jdbc.update("UPDATE simulated_orders SET reserved_cash=cash_per_share*?,reserved_shares=CASE WHEN side='SELL' AND reservation_managed THEN ? ELSE 0 END WHERE id=?",qty,qty,id);
 }
 public void release(long id) { remaining(id,BigDecimal.ZERO); }
 public record Availability(BigDecimal availableBuyingPower,BigDecimal reservedCash,List<Map<String,Object>> positions) {}
 @org.springframework.transaction.annotation.Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
 public Availability availability(long portfolioId) {
  BigDecimal balance=jdbc.queryForObject("SELECT cash_balance FROM portfolios WHERE id=?",BigDecimal.class,portfolioId);
  BigDecimal reserved=cash(portfolioId,-1);
  return new Availability(balance.subtract(reserved),reserved,jdbc.queryForList("SELECT h.asset_id,h.quantity,COALESCE(r.reserved,0) AS reserved_quantity,h.quantity-COALESCE(r.reserved,0) AS available_quantity FROM holdings h LEFT JOIN (SELECT asset_id,SUM(reserved_shares) reserved FROM simulated_orders WHERE portfolio_id=? GROUP BY asset_id) r ON r.asset_id=h.asset_id WHERE h.portfolio_id=?",portfolioId,portfolioId));
 }
}
