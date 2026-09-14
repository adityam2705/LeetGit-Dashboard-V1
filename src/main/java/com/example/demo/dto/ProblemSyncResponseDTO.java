package com.example.demo.dto;

public class ProblemSyncResponseDTO {

    private ProblemResponseDTO problem;
    private boolean githubSynced;

    public ProblemSyncResponseDTO(
            ProblemResponseDTO problem,
            boolean githubSynced) {
        this.problem = problem;
        this.githubSynced = githubSynced;
    }

    public ProblemResponseDTO getProblem() {
        return problem;
    }

    public boolean isGithubSynced() {
        return githubSynced;
    }
}