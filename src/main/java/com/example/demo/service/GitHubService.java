package com.example.demo.service;

import com.example.demo.model.GitHubAccount;
import com.example.demo.model.User;
import com.example.demo.repository.GitHubAccountRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class GitHubService {

    private final GitHubAccountRepository gitHubAccountRepository;
    private final UserRepository userRepository;

    private final Map<String, String> stateToUser = new HashMap<>();
    private final ObjectMapper objectMapper;

    @Value("${github.client-id}")
    private String clientId;

    @Value("${github.client-secret}")
    private String clientSecret;

    @Value("${github.redirect-uri}")
    private String redirectUri;

    public GitHubService(
            ObjectMapper objectMapper,
            GitHubAccountRepository gitHubAccountRepository,
            UserRepository userRepository) {

        this.objectMapper = objectMapper;
        this.gitHubAccountRepository = gitHubAccountRepository;
        this.userRepository = userRepository;
    }

    public boolean validateState(String state) {
        return stateToUser.containsKey(state);
    }

    public String getUsernameForState(String state) {
        return stateToUser.get(state);
    }

    public String exchangeCodeForToken(String code, String username) {

        RestClient restClient = RestClient.create();

        String response = restClient.post()
                .uri(uriBuilder -> uriBuilder
                        .scheme("https")
                        .host("github.com")
                        .path("/login/oauth/access_token")
                        .queryParam("client_id", clientId)
                        .queryParam("client_secret", clientSecret)
                        .queryParam("code", code)
                        .queryParam("redirect_uri", redirectUri)
                        .build())
                .header("Accept", "application/json")
                .retrieve()
                .body(String.class);

        try {
            JsonNode json = objectMapper.readTree(response);

            String accessToken = json.get("access_token").asText();
            String refreshToken = json.get("refresh_token").asText();
            long expiresIn = json.get("expires_in").asLong();

            String githubUser = getGitHubUser(accessToken);

            JsonNode githubUserJson = objectMapper.readTree(githubUser);
            

            Long githubUserId = githubUserJson.get("id").asLong();
            String githubUsername = githubUserJson.get("login").asText();

            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            GitHubAccount account = gitHubAccountRepository
                    .findByUser(user)
                    .orElse(new GitHubAccount());

            account.setUser(user);
            account.setGithubUserId(githubUserId);
            account.setGithubUsername(githubUsername);
            account.setAccessToken(accessToken);
            account.setRefreshToken(refreshToken);
            account.setExpiresAt(
                    java.time.Instant.now().plusSeconds(expiresIn)
            );

            gitHubAccountRepository.save(account);

            System.out.println("GitHub user ID: " + githubUserId);
            System.out.println("GitHub username: " + githubUsername);

        } catch (Exception e) {
            throw new RuntimeException("Failed to process GitHub response", e);
        }

        return "GitHub connected successfully";
    }

    public String getGitHubUser(String accessToken) {

        RestClient restClient = RestClient.create();

        return restClient.get()
                .uri("https://api.github.com/user")
                .header("Authorization", "Bearer " + accessToken)
                .header("Accept", "application/vnd.github+json")
                .retrieve()
                .body(String.class);
    }

    public String generateState(String username) {

        String state = UUID.randomUUID().toString();

        stateToUser.put(state, username);

        return state;
    }

    public String getAuthorizationUrl(String state) {

        return "https://github.com/login/oauth/authorize"
                + "?client_id=" + clientId
                + "&redirect_uri=" + redirectUri
                + "&state=" + state;
    }
}