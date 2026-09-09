package com.example.demo.mapper;

import com.example.demo.dto.ProblemRequestDTO;
import com.example.demo.dto.ProblemResponseDTO;
import com.example.demo.model.Problem;
import org.springframework.stereotype.Component;

@Component
public class ProblemMapper {
    public Problem toEntity(ProblemRequestDTO dto) {

        Problem problem = new Problem();

        problem.setLeetcodeId(dto.getLeetcodeId());
        problem.setTitle(dto.getTitle());
        problem.setSlug(dto.getSlug());
        problem.setDifficulty(dto.getDifficulty());

        return problem;
    }

    public ProblemResponseDTO toDTO(Problem problem) {

        ProblemResponseDTO dto = new ProblemResponseDTO();

        dto.setId(problem.getId());
        dto.setLeetcodeId(problem.getLeetcodeId());
        dto.setTitle(problem.getTitle());
        dto.setSlug(problem.getSlug());
        dto.setDifficulty(problem.getDifficulty());

        return dto;
    }
}
