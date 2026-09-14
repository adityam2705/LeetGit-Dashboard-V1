package com.example.demo.service;

import java.util.List;
import java.util.Optional;
import com.example.demo.dto.ProblemRequestDTO;
import com.example.demo.dto.ProblemResponseDTO;
import com.example.demo.dto.ProblemSyncResponseDTO;
import com.example.demo.mapper.ProblemMapper;
import com.example.demo.model.Problem;
import com.example.demo.model.UserProblem;
import com.example.demo.repository.ProblemRepository;
import com.example.demo.repository.UserProblemRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;
import com.example.demo.exception.ProblemNotFoundException;
import com.example.demo.model.User;
import com.example.demo.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;


@Service
public class ProblemService {

    private final ProblemRepository problemRepository;
    private final ProblemMapper problemMapper;
    private final UserRepository userRepository;
    private final UserProblemRepository userProblemRepository;

    public ProblemService(
            ProblemRepository problemRepository,
            ProblemMapper problemMapper,
            UserRepository userRepository,
            UserProblemRepository userProblemRepository) {

        this.problemRepository = problemRepository;
        this.problemMapper = problemMapper;
        this.userRepository = userRepository;
        this.userProblemRepository = userProblemRepository;
    }

    public ProblemResponseDTO saveProblem(ProblemRequestDTO request) {

        Problem problem = problemMapper.toEntity(request);

        Problem savedProblem = problemRepository.save(problem);

        return problemMapper.toDTO(savedProblem);
    }

    public ProblemResponseDTO getProblem(Long id) {

        Problem problem = problemRepository.findById(id)
                .orElseThrow(() ->
                        new ProblemNotFoundException(
                                "Problem '" + id + "' not found"
                        ));

        return problemMapper.toDTO(problem);
    }

    public List<ProblemResponseDTO> getAllProblems() {

        List<Problem> problems = problemRepository.findAll();

        return problems.stream()
                .map(problemMapper::toDTO)
                .toList();
    }

    public List<Long> getExistingProblemIds() {

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        String username = authentication.getName();

        User user = userRepository.findByUsername(username)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        return userProblemRepository.findLeetcodeIdsByUser(user);
    }

    @Transactional
    public ProblemSyncResponseDTO syncProblem(
            ProblemRequestDTO request) {

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        String username = authentication.getName();

        User user = userRepository.findByUsername(username)
                .orElseThrow(() ->
                        new RuntimeException("User not found"));

        Problem problem = problemRepository
                .findByLeetcodeId(request.getLeetcodeId())
                .orElse(null);

        if (problem == null) {

            problem = problemMapper.toEntity(request);

            problem = problemRepository.save(problem);
        }


        Optional<UserProblem> existingUserProblem =
                userProblemRepository.findByUserAndProblem(
                        user,
                        problem
                );

        if (existingUserProblem.isPresent()) {

            UserProblem userProblem =
                    existingUserProblem.get();

            return new ProblemSyncResponseDTO(
                    problemMapper.toDTO(problem),
                    userProblem.isGithubSynced()
            );
        }


        UserProblem userProblem =
                new UserProblem();

        userProblem.setUser(user);
        userProblem.setProblem(problem);

        userProblem =
                userProblemRepository.save(userProblem);

        return new ProblemSyncResponseDTO(
                problemMapper.toDTO(problem),
                userProblem.isGithubSynced()
        );
    }
}