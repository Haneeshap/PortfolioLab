package com.portfoliolab.backend.research;
import java.time.LocalDate;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/research/assets/{assetId}")
public class ResearchController {
 private final ResearchService service;public ResearchController(ResearchService service){this.service=service;}
 @GetMapping("/history") public ResearchService.Result history(@PathVariable long assetId,@RequestParam LocalDate from,@RequestParam LocalDate to,@RequestParam(defaultValue="14")int period){return service.research(assetId,from,to,period);}
}
