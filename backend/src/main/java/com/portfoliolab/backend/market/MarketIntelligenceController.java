package com.portfoliolab.backend.market;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/market/intelligence")
public class MarketIntelligenceController {
 private final MarketIntelligenceService service;
 public MarketIntelligenceController(MarketIntelligenceService service){this.service=service;}
 @GetMapping public List<MarketIntelligenceService.IntelligenceEvent> feed(
  @RequestParam(defaultValue="1") long portfolioId,
  @RequestParam(defaultValue="all") String scope,
  @RequestParam(defaultValue="all") String type,
  @RequestParam(defaultValue="50") int limit){return service.feed(portfolioId,scope,type,limit);}
 @ExceptionHandler(IllegalArgumentException.class)
 public ResponseEntity<Map<String,String>> invalid(IllegalArgumentException e){return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error",e.getMessage()));}
}
