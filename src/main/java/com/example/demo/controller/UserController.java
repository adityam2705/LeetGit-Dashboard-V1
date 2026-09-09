 package com.example.demo.controller;

import com.example.demo.dto.UserRequestDTO;
import com.example.demo.dto.UserResponseDTO;
import com.example.demo.model.User;
import com.example.demo.service.UserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

 @RestController
 @RequestMapping("/users")
public class UserController {

    private final UserService userservice;

    public UserController(UserService userservice){this.userservice=userservice;}

    @PostMapping
    public ResponseEntity<UserResponseDTO> saveUser(@Valid @RequestBody UserRequestDTO userRequestDTO) {

        UserResponseDTO response = userservice.saveUser(userRequestDTO);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response); }

    @GetMapping("{id}")
    public ResponseEntity<UserResponseDTO> getUser(@PathVariable Long id){
         return ResponseEntity.ok(userservice.getUser(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserResponseDTO> updateUser(@PathVariable Long id, @RequestBody UserRequestDTO request){
        UserResponseDTO response = userservice.updateUser(id, request);

        return ResponseEntity.ok(response);}

    @DeleteMapping("/{id}")
     public ResponseEntity<Void> deleteUser(@PathVariable Long id){
        userservice.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

     @GetMapping
     public ResponseEntity<Page<UserResponseDTO>> getAllUsers(
             Pageable pageable) {

         return ResponseEntity.ok(
                 userservice.getAllUsers(pageable)
         );
     }
     
}