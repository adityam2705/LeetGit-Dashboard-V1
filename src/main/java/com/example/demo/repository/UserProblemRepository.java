package com.example.demo.repository;

import com.example.demo.model.User;
import com.example.demo.model.UserProblem;
import com.example.demo.model.Problem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserProblemRepository extends JpaRepository<UserProblem, Long> {

    Optional<UserProblem> findByUserAndProblem(User user, Problem problem);
}