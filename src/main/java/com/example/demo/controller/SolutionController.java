package com.example.demo.controller;

import com.example.demo.dto.SolutionRequestDTO;
import com.example.demo.dto.SolutionResponseDTO;
import com.example.demo.service.SolutionService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/solutions")
public class SolutionController {

    private final SolutionService solutionService;

    public SolutionController(SolutionService solutionService) {
        this.solutionService = solutionService;
    }

    @PostMapping("/sync/{leetcodeId}")
    @ResponseStatus(HttpStatus.CREATED)
    public SolutionResponseDTO syncSolution(
            @PathVariable Long leetcodeId,
            @RequestBody SolutionRequestDTO request) {

        return solutionService.saveSolution(
                leetcodeId,
                request
        );
    }
}
