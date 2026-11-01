package com.portfoliolab.backend.search;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/search")
public class AssetSearchController {

    private final AssetSearchService assetSearchService;

    public AssetSearchController(AssetSearchService assetSearchService) {
        this.assetSearchService = assetSearchService;
    }

    @GetMapping("/semantic")
    public List<AssetSearchResult> semanticSearch(
            @RequestParam String q,
            @RequestParam(defaultValue = "5") int limit) {
        return assetSearchService.semanticSearch(q, limit);
    }
}