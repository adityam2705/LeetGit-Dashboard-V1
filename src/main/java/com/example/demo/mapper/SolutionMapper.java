package com.example.demo.mapper;

import com.example.demo.dto.SolutionRequestDTO;
import com.example.demo.dto.SolutionResponseDTO;
import com.example.demo.model.Solution;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface SolutionMapper {

    SolutionResponseDTO toDTO(Solution solution);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "userProblem", ignore = true)
    Solution toEntity(SolutionRequestDTO request);
}