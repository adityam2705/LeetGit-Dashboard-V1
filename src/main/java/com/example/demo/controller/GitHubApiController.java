package com.example.demo.controller;

import com.example.demo.service.GitHubApiService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

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
                authentication.getName(),
                "adityam2705",
                "leetcode-solutions"
        );
    }
}
