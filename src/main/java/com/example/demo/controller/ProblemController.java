package com.example.demo.controller;

import com.example.demo.dto.ProblemRequestDTO;
import com.example.demo.dto.ProblemResponseDTO;
import com.example.demo.dto.ProblemSyncResponseDTO;
import com.example.demo.service.ProblemService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/problems")
public class ProblemController {

    private final ProblemService problemService;

    public ProblemController(ProblemService problemService) {
        this.problemService = problemService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProblemResponseDTO createProblem(
            @RequestBody ProblemRequestDTO request) {

        return problemService.saveProblem(request);
    }

    @GetMapping("/{id}")
    public ProblemResponseDTO getProblem(@PathVariable Long id) {

        return problemService.getProblem(id);
    }

    @GetMapping
    public List<ProblemResponseDTO> getAllProblems() {

        return problemService.getAllProblems();
    }

    @PostMapping("/sync")
    public ProblemSyncResponseDTO syncProblem(
            @RequestBody ProblemRequestDTO request) {

        return problemService.syncProblem(request);
    }
}
