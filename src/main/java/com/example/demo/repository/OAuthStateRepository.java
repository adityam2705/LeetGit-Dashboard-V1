package com.example.demo.repository;


import com.example.demo.model.OAuthState;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OAuthStateRepository
        extends JpaRepository<OAuthState, String> {
}
