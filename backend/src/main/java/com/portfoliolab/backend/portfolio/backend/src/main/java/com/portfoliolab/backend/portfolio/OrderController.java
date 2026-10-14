
package com.portfoliolab.backend.portfolio;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/orders")
public class OrderController {

    private final OrderService orderService;
    private final OrderPreviewService previewService;

    public OrderController(
            OrderService orderService,
            OrderPreviewService previewService
    ) {
        this.orderService = orderService;
        this.previewService = previewService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse placeOrder(
            @PathVariable Long portfolioId,
            @RequestBody OrderRequest request
    ) {
        return orderService.placeOrder(portfolioId, request);
    }

    @PostMapping("/preview")
    public OrderPreviewResponse previewOrder(
            @PathVariable Long portfolioId,
            @RequestBody OrderRequest request
    ) {
        return previewService.preview(portfolioId, request);
    }
}
