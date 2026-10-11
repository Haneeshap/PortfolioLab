package com.portfoliolab.backend.asset;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AssetService {

    private final AssetRepository assetRepository;

    public AssetService(AssetRepository assetRepository) {
        this.assetRepository = assetRepository;
    }

    public List<AssetResponse> getAllAssets() {
        return assetRepository.findAll(
            Sort.by(Sort.Direction.ASC, "symbol")
        ).stream()
         .map(AssetResponse::from)
         .toList();
    }
}