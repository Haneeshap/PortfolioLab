package com.portfoliolab.backend.oms;

import com.portfoliolab.backend.portfolio.OrderRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/simulated-orders")
public class SimulatedOrderController {
 private final SimulatedOrderService service;
 public SimulatedOrderController(SimulatedOrderService service){this.service=service;}
 @PostMapping @ResponseStatus(HttpStatus.CREATED)
 public SimulatedOrderService.OrderView submit(@PathVariable long portfolioId,@RequestBody OrderRequest request){return service.submit(portfolioId,request);}
 @GetMapping public List<SimulatedOrderService.OrderView> list(@PathVariable long portfolioId){return service.list(portfolioId);}
 @GetMapping("/{orderId}") public SimulatedOrderService.OrderView get(@PathVariable long portfolioId,@PathVariable long orderId){return service.get(portfolioId,orderId);}
 @PostMapping("/{orderId}/cancel") public SimulatedOrderService.OrderView cancel(@PathVariable long portfolioId,@PathVariable long orderId){return service.cancel(portfolioId,orderId);}
}
