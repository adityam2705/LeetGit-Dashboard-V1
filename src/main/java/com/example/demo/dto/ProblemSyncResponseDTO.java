package com.example.demo.dto;

public class ProblemSyncResponseDTO {

    private ProblemResponseDTO problem;
    private boolean newForUser;

    public ProblemSyncResponseDTO(
            ProblemResponseDTO problem,
            boolean newForUser) {
        this.problem = problem;
        this.newForUser = newForUser;
    }

    public ProblemResponseDTO getProblem() {
        return problem;
    }

    public boolean isNewForUser() {
        return newForUser;
    }
}
