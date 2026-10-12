package com.portfoliolab.backend.portfolio;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HoldingRepository extends JpaRepository<Holding, Long> {

    @EntityGraph(attributePaths = {"asset"})
    List<Holding> findByPortfolioId(Long portfolioId);

    Optional<Holding> findByPortfolioIdAndAssetId(
            Long portfolioId,
            Long assetId
    );
}