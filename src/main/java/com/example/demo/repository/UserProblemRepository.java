package com.example.demo.repository;

import com.example.demo.model.User;
import com.example.demo.model.UserProblem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserProblemRepository
        extends JpaRepository<UserProblem, Long> {

    Optional<UserProblem> findByUserAndProblem(
            User user,
            com.example.demo.model.Problem problem
    );

    List<UserProblem> findByUserAndGithubSyncedFalse(
            User user
    );

    List<Long> findLeetcodeIdsByUser(
            User user
    );
}