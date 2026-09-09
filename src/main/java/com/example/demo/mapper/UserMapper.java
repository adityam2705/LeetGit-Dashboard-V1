package com.example.demo.mapper;

import com.example.demo.dto.UserRequestDTO;
import com.example.demo.dto.UserResponseDTO;
import com.example.demo.model.User;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface UserMapper {

    UserResponseDTO toDTO(User user);

    @Mapping(target = "password", source = "password")
    User toEntity(UserRequestDTO request);

    @Mapping(target = "password", ignore = true)
    void updateUserFromDTO(
            UserRequestDTO request,
            @MappingTarget User user);
}

