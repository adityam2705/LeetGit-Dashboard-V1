package com.example.demo.repository;

import com.example.demo.model.Solution;
import com.example.demo.model.UserProblem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SolutionRepository extends JpaRepository<Solution, Long> {

    Optional<Solution> findByLeetcodeSubmissionId(Long leetcodeSubmissionId);

    Optional<Solution> findByUserProblemAndLeetcodeSubmissionId(
            UserProblem userProblem,
            Long leetcodeSubmissionId
    );
}