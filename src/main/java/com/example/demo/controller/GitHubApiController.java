package com.example.demo.controller;

import com.example.demo.dto.GitHubRepositoryRequestDTO;
import com.example.demo.service.GitHubApiService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/github/api")
public class GitHubApiController {

    private final GitHubApiService gitHubApiService;

    public GitHubApiController(GitHubApiService gitHubApiService) {
        this.gitHubApiService = gitHubApiService;
    }

    @GetMapping("/test-user")
    public String testGitHubUser(Authentication authentication) {
        return gitHubApiService
                .getAuthenticatedUser(authentication.getName());
    }

    @GetMapping("/repository")
    public String getRepositoryContents(Authentication authentication) {

        return gitHubApiService.getRepositoryContents(
                authentication.getName()
        );
    }

    @GetMapping("/status")
    public Map<String, Object> getGitHubStatus(Authentication authentication) {

        String username = authentication.getName();

        boolean connected =
                gitHubApiService.isGitHubConnected(username);

        return Map.of(
                "connected", connected
        );
    }

    @GetMapping("/repositories")
    public String getRepositories(Authentication authentication) {

        return gitHubApiService
                .getRepositories(authentication.getName());
    }

    @PostMapping("/repository")
    public String selectRepository(
            Authentication authentication,
            @RequestBody GitHubRepositoryRequestDTO request) {

        return gitHubApiService.selectRepository(
                authentication.getName(),
                request
        );
    }

}
