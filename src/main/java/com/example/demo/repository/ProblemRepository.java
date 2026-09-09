package com.example.demo.repository;

import com.example.demo.model.Problem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProblemRepository extends JpaRepository<Problem, Long> {
    Optional<Problem> findByLeetcodeId(Long leetcodeId);
}
