package com.portfoliolab.backend.watchlist;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/watchlists")
public class WatchlistController {
 private final JdbcTemplate jdbc;
 public WatchlistController(JdbcTemplate jdbc) { this.jdbc = jdbc; }
 public record Watchlist(long id, String name, List<String> symbols) {}
 public record NameRequest(String name) {}
 public record SymbolRequest(String symbol) {}
 private void portfolio(long id) {
  Integer n = jdbc.queryForObject("SELECT count(*) FROM portfolios WHERE id=?",Integer.class,id);
  if (n == null || n == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Portfolio not found");
 }
 private void owns(long p,long id) {
  Integer n = jdbc.queryForObject("SELECT count(*) FROM watchlists WHERE id=? AND portfolio_id=?",Integer.class,id,p);
  if (n == null || n == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Watchlist not found");
 }
 private String validName(NameRequest r) {
  if (r == null || r.name() == null || r.name().trim().isEmpty() || r.name().trim().length() > 80)
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Name must be 1–80 characters");
  return r.name().trim();
 }
 private String validSymbol(SymbolRequest r) {
  if (r == null || r.symbol() == null || !r.symbol().trim().toUpperCase(java.util.Locale.ROOT).matches("[A-Z0-9._-]{1,20}"))
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid symbol");
  return r.symbol().trim().toUpperCase(java.util.Locale.ROOT);
 }
 private void duplicateGuard(Runnable operation) {
  try { operation.run(); }
  catch (org.springframework.dao.DuplicateKeyException e) { throw new ResponseStatusException(HttpStatus.CONFLICT,"Already exists"); }
  catch (org.springframework.dao.DataIntegrityViolationException e) { throw new ResponseStatusException(HttpStatus.CONFLICT,"Duplicate name or symbol"); }
 }
 @GetMapping
 public List<Watchlist> list(@PathVariable long portfolioId) {
  portfolio(portfolioId);
  return jdbc.query("SELECT id,name FROM watchlists WHERE portfolio_id=? ORDER BY created_at,id",(rs,i) -> {
   long id=rs.getLong("id");
   List<String> symbols=jdbc.queryForList("SELECT a.symbol FROM watchlist_items wi JOIN assets a ON a.id=wi.asset_id WHERE wi.watchlist_id=? ORDER BY wi.added_at,a.symbol",String.class,id);
   return new Watchlist(id,rs.getString("name"),symbols);
  },portfolioId);
 }
 @PostMapping @ResponseStatus(HttpStatus.CREATED)
 public Map<String,Long> create(@PathVariable long portfolioId,@RequestBody NameRequest r) {
  portfolio(portfolioId); String name=validName(r);
  try {
   Long id=jdbc.queryForObject("INSERT INTO watchlists(portfolio_id,name) VALUES (?,?) RETURNING id",Long.class,portfolioId,name);
   return Map.of("id",id);
  } catch (org.springframework.dao.DataIntegrityViolationException e) { throw new ResponseStatusException(HttpStatus.CONFLICT,"Watchlist name already exists"); }
 }
 @PatchMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
 public void rename(@PathVariable long portfolioId,@PathVariable long id,@RequestBody NameRequest r) {
  owns(portfolioId,id); String name=validName(r);
  duplicateGuard(() -> jdbc.update("UPDATE watchlists SET name=? WHERE id=? AND portfolio_id=?",name,id,portfolioId));
 }
 @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
 public void delete(@PathVariable long portfolioId,@PathVariable long id) {
  owns(portfolioId,id); jdbc.update("DELETE FROM watchlists WHERE id=? AND portfolio_id=?",id,portfolioId);
 }
 @PostMapping("/{id}/items") @ResponseStatus(HttpStatus.CREATED)
 public void add(@PathVariable long portfolioId,@PathVariable long id,@RequestBody SymbolRequest r) {
  owns(portfolioId,id); String symbol=validSymbol(r);
  Long assetId=jdbc.query("SELECT id FROM assets WHERE symbol=?",rs -> rs.next()?rs.getLong(1):null,symbol);
  if (assetId == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown asset");
  duplicateGuard(() -> jdbc.update("INSERT INTO watchlist_items(watchlist_id,asset_id) VALUES (?,?)",id,assetId));
 }
 @DeleteMapping("/{id}/items/{symbol}") @ResponseStatus(HttpStatus.NO_CONTENT)
 public void remove(@PathVariable long portfolioId,@PathVariable long id,@PathVariable String symbol) {
  owns(portfolioId,id);
  jdbc.update("DELETE FROM watchlist_items wi USING assets a WHERE wi.asset_id=a.id AND wi.watchlist_id=? AND a.symbol=?",id,symbol.toUpperCase(java.util.Locale.ROOT));
 }
}
