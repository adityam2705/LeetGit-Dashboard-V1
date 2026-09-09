package com.example.demo.service;

import com.example.demo.dto.UserRequestDTO;
import com.example.demo.dto.UserResponseDTO;
import com.example.demo.exception.UserNotFoundException;
import com.example.demo.mapper.UserMapper;
import com.example.demo.model.User;
import com.example.demo.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserMapper userMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    @Test
    void getUser_shouldReturnUser() {
        Long id = 1L;

        User user = new User();
        user.setUsername("testuser");

        UserResponseDTO response = new UserResponseDTO();
        response.setUsername("testuser");

        when(userRepository.findById(id))
                .thenReturn(Optional.of(user));

        when(userMapper.toDTO(user))
                .thenReturn(response);

        UserResponseDTO result = userService.getUser(id);
        assertSame(response, result);
        verify(userRepository).findById(id);
        verify(userMapper).toDTO(user);

        }

    @Test
    void getUser_shouldThrowExceptionWhenUserNotFound() {

        Long id = 999L;

        when(userRepository.findById(id))
                .thenReturn(Optional.empty());

        assertThrows(
                UserNotFoundException.class,
                () -> userService.getUser(id)
        );

        verify(userMapper, never()).toDTO(any());
    }

    @Test
    void saveUser_shouldSaveUserWithEncodedPassword() {

        // Arrange
        UserRequestDTO request = new UserRequestDTO();
        request.setUsername("testuser");
        request.setEmail("test@example.com");
        request.setPassword("test123");

        User user = new User();
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setPassword("test123");

        User savedUser = new User();
        savedUser.setUsername("testuser");
        savedUser.setEmail("test@example.com");
        savedUser.setPassword("$2a$10$encodedPassword");

        UserResponseDTO response = new UserResponseDTO();

        when(userMapper.toEntity(request)).thenReturn(user);
        when(passwordEncoder.encode("test123"))
                .thenReturn("$2a$10$encodedPassword");
        when(userRepository.save(user)).thenReturn(savedUser);
        when(userMapper.toDTO(savedUser)).thenReturn(response);

        // Act
        UserResponseDTO result = userService.saveUser(request);

        // Assert
        assertSame(response, result);

        assertEquals(
                "$2a$10$encodedPassword",
                user.getPassword()
        );

        verify(userMapper).toEntity(request);
        verify(passwordEncoder).encode("test123");
        verify(userRepository).save(user);
        verify(userMapper).toDTO(savedUser);
    }
}
