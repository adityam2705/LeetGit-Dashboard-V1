package com.example.demo.controller;

import com.example.demo.service.GitHubService;
import jakarta.annotation.Nonnull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.security.core.Authentication;

import java.net.URI;

@RestController
@RequestMapping("/github")
public class GitHubController {

    private final GitHubService gitHubService;

    public GitHubController(GitHubService gitHubService) {
        this.gitHubService = gitHubService;
    }

    @GetMapping("/callback")
    public String callback(
            @RequestParam String code,
            @RequestParam String state) {

        if (!gitHubService.validateState(state)) {
            return "Invalid state";
        }

        String username = gitHubService.getUsernameForState(state);

        return gitHubService.exchangeCodeForToken(code, username, state);
    }

    @GetMapping("/connect")
    public ResponseEntity<Void> connect() {

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        String username = authentication.getName();

        String state = gitHubService.generateState(username);

        String authorizationUrl =
                gitHubService.getAuthorizationUrl(state);

        return ResponseEntity
                .status(HttpStatus.FOUND)
                .location(URI.create(authorizationUrl))
                .build();
    }

    @GetMapping("/connect-url")
    public String connectUrl(Authentication authentication) {

        String username = authentication.getName();

        String state = gitHubService.generateState(username);

        return gitHubService.getAuthorizationUrl(state);
    }
}

