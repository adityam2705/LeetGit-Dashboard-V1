package com.example.demo.service;

import com.example.demo.dto.SolutionRequestDTO;
import com.example.demo.dto.SolutionResponseDTO;
import com.example.demo.exception.ProblemNotFoundException;
import com.example.demo.mapper.SolutionMapper;
import com.example.demo.model.Problem;
import com.example.demo.model.Solution;
import com.example.demo.model.User;
import com.example.demo.model.UserProblem;
import com.example.demo.repository.ProblemRepository;
import com.example.demo.repository.SolutionRepository;
import com.example.demo.repository.UserProblemRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import com.example.demo.service.GitHubApiService;
@Service
public class SolutionService {

    private final GitHubApiService gitHubApiService;
    private final SolutionRepository solutionRepository;
    private final SolutionMapper solutionMapper;
    private final UserRepository userRepository;
    private final ProblemRepository problemRepository;
    private final UserProblemRepository userProblemRepository;

    public SolutionService(
            SolutionRepository solutionRepository,
            SolutionMapper solutionMapper,
            UserRepository userRepository,
            ProblemRepository problemRepository,
            UserProblemRepository userProblemRepository,
            GitHubApiService gitHubApiService) {

        this.solutionRepository = solutionRepository;
        this.solutionMapper = solutionMapper;
        this.userRepository = userRepository;
        this.problemRepository = problemRepository;
        this.userProblemRepository = userProblemRepository;
        this.gitHubApiService = gitHubApiService;
    }

    public SolutionResponseDTO saveSolution(
            Long leetcodeId,
            SolutionRequestDTO request) {

        // 1. Get currently authenticated user
        Authentication authentication =
                SecurityContextHolder.getContext()
                        .getAuthentication();

        String username = authentication.getName();

        User user = userRepository
                .findByUsername(username)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        // 2. Find global problem
        Problem problem = problemRepository
                .findByLeetcodeId(leetcodeId)
                .orElseThrow(() ->
                        new ProblemNotFoundException(
                                "Problem '" + leetcodeId + "' not found"
                        ));

        // 3. Find UserProblem relationship
        UserProblem userProblem =
                userProblemRepository
                        .findByUserAndProblem(user, problem)
                        .orElseGet(() -> {

                            UserProblem newUserProblem =
                                    new UserProblem();

                            newUserProblem.setUser(user);
                            newUserProblem.setProblem(problem);

                            return userProblemRepository
                                    .save(newUserProblem);
                        });

        // 4. Prevent duplicate submission
        Solution existingSolution =
                solutionRepository
                        .findByLeetcodeSubmissionId(
                                request.getLeetcodeSubmissionId()
                        )
                        .orElse(null);

        if (existingSolution != null) {
            return solutionMapper.toDTO(existingSolution);
        }

        // 5. Convert DTO → Entity
        Solution solution =
                solutionMapper.toEntity(request);

        // 6. Connect solution to UserProblem
        solution.setUserProblem(userProblem);

        // 7. Save
        Solution savedSolution =
                solutionRepository.save(solution);

        // Create GitHub file
        gitHubApiService.createSolutionFile(
                username,
                savedSolution
        );

        // 8. Return response DTO
        return solutionMapper.toDTO(savedSolution);
    }
}
