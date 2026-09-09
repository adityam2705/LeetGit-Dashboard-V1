package com.example.demo.repository;

import com.example.demo.model.GitHubAccount;
import com.example.demo.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GitHubAccountRepository
        extends JpaRepository<GitHubAccount, Long> {

    Optional<GitHubAccount> findByUser(User user);
    Optional<GitHubAccount> findByUser_Username(String username);
}
