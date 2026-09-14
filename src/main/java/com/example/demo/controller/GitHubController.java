package com.example.demo.controller;

import com.example.demo.dto.GitHubRepositoryRequestDTO;
import com.example.demo.service.GitHubApiService;
import com.example.demo.service.GitHubService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/github")
public class GitHubController {

    private final GitHubService gitHubService;
    private final GitHubApiService gitHubApiService;

    public GitHubController(
            GitHubService gitHubService,
            GitHubApiService gitHubApiService) {

        this.gitHubService = gitHubService;
        this.gitHubApiService = gitHubApiService;
    }

    // =========================================================
    // BULK SYNC
    // =========================================================

    @PostMapping("/sync")
    public String syncToGitHub(
            Authentication authentication) {

        String username =
                authentication.getName();

        return gitHubApiService
                .syncPendingSolutions(username);
    }


    // =========================================================
    // TEMPORARY BULK TEST
    // =========================================================

    @PostMapping("/test-bulk")
    public String testBulkSync(
            Authentication authentication,
            @RequestParam java.util.List<Long> solutionIds) {

        String username =
                authentication.getName();

        return gitHubApiService.testBulkSync(
                username,
                solutionIds
        );
    }


    // =========================================================
    // GITHUB OAUTH CALLBACK
    // =========================================================

    @GetMapping("/callback")
    public String callback(
            @RequestParam String code,
            @RequestParam String state) {

        if (!gitHubService.validateState(state)) {
            return "Invalid state";
        }

        String username =
                gitHubService.getUsernameForState(state);

        return gitHubService.exchangeCodeForToken(
                code,
                username,
                state
        );
    }


    // =========================================================
    // CONNECT GITHUB
    // =========================================================

    @GetMapping("/connect")
    public ResponseEntity<Void> connect(
            Authentication authentication) {

        String username =
                authentication.getName();

        String state =
                gitHubService.generateState(username);

        String authorizationUrl =
                gitHubService.getAuthorizationUrl(state);

        return ResponseEntity
                .status(HttpStatus.FOUND)
                .location(URI.create(authorizationUrl))
                .build();
    }


    // =========================================================
    // GET CONNECT URL
    // =========================================================

    @GetMapping("/connect-url")
    public String connectUrl(
            Authentication authentication) {

        String username =
                authentication.getName();

        String state =
                gitHubService.generateState(username);

        return gitHubService.getAuthorizationUrl(state);
    }
}