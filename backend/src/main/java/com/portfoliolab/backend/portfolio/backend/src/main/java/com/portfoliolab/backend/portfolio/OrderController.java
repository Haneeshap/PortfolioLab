
package com.portfoliolab.backend.portfolio;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse placeOrder(
            @PathVariable Long portfolioId,
            @RequestBody OrderRequest request
    ) {
        return orderService.placeOrder(portfolioId, request);
    }
}
