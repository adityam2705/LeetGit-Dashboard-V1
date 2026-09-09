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


        Authentication authentication =
                SecurityContextHolder.getContext()
                        .getAuthentication();

        String username = authentication.getName();

        User user = userRepository
                .findByUsername(username)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));


        Problem problem = problemRepository
                .findByLeetcodeId(leetcodeId)
                .orElseThrow(() ->
                        new ProblemNotFoundException(
                                "Problem '" + leetcodeId + "' not found"
                        ));


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


        Solution existingSolution =
                solutionRepository
                        .findByLeetcodeSubmissionId(
                                request.getLeetcodeSubmissionId()
                        )
                        .orElse(null);

        if (existingSolution != null) {
            return solutionMapper.toDTO(existingSolution);
        }


        Solution solution =
                solutionMapper.toEntity(request);


        solution.setUserProblem(userProblem);


        Solution savedSolution =
                solutionRepository.save(solution);


        gitHubApiService.createSolutionFile(
                username,
                savedSolution
        );


        return solutionMapper.toDTO(savedSolution);
    }
}
