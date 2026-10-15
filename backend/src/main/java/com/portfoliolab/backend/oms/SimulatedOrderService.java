package com.portfoliolab.backend.oms;

import com.portfoliolab.backend.portfolio.OrderRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

@Service
public class SimulatedOrderService {
 private final JdbcTemplate jdbc;
 public SimulatedOrderService(JdbcTemplate jdbc) { this.jdbc=jdbc; }
 public record OrderView(long id,long portfolioId,long assetId,String side,BigDecimal requestedQuantity,
                         BigDecimal filledQuantity,String status,String failureReason) {}
 private final org.springframework.jdbc.core.RowMapper<OrderView> row=(rs,n)->new OrderView(
  rs.getLong("id"),rs.getLong("portfolio_id"),rs.getLong("asset_id"),rs.getString("side"),
  rs.getBigDecimal("requested_quantity"),rs.getBigDecimal("filled_quantity"),
  rs.getString("status"),rs.getString("failure_reason"));
 @Transactional
 public OrderView submit(long portfolioId, OrderRequest request) {
  if(request==null || request.assetId()==null || request.type()==null || request.quantity()==null)
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Asset, side and quantity required");
  String side=request.type().trim().toUpperCase(Locale.ROOT);
  BigDecimal qty=request.quantity();
  if(!List.of("BUY","SELL").contains(side) || qty.signum()<=0 || qty.stripTrailingZeros().scale()>0 || qty.precision()>13)
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid side or quantity");
  Integer p=jdbc.queryForObject("SELECT count(*) FROM portfolios WHERE id=?",Integer.class,portfolioId);
  Integer a=jdbc.queryForObject("SELECT count(*) FROM assets WHERE id=?",Integer.class,request.assetId());
  if(p==null||p==0||a==null||a==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Portfolio or asset not found");
  Long id=jdbc.queryForObject("INSERT INTO simulated_orders(portfolio_id,asset_id,side,requested_quantity) VALUES(?,?,?,?) RETURNING id",
   Long.class,portfolioId,request.assetId(),side,qty);
  return get(portfolioId,id);
 }
 public OrderView get(long portfolioId,long orderId){
  return jdbc.query("SELECT * FROM simulated_orders WHERE id=? AND portfolio_id=?",row,orderId,portfolioId)
   .stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Order not found"));
 }
 public List<OrderView> list(long portfolioId){
  return jdbc.query("SELECT * FROM simulated_orders WHERE portfolio_id=? ORDER BY id DESC LIMIT 100",row,portfolioId);
 }
 @Transactional
 public OrderView cancel(long portfolioId,long orderId){
  List<OrderView> locked=jdbc.query("SELECT * FROM simulated_orders WHERE id=? AND portfolio_id=? FOR UPDATE",row,orderId,portfolioId);
  if(locked.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Order not found");
  OrderView current=locked.get(0);
  if(!List.of("SUBMITTED","ACCEPTED","PARTIALLY_FILLED").contains(current.status()))
   throw new ResponseStatusException(HttpStatus.CONFLICT,"Order is already terminal");
  jdbc.update("UPDATE simulated_orders SET status='CANCELLED',updated_at=NOW() WHERE id=?",orderId);
  return get(portfolioId,orderId);
 }

}
