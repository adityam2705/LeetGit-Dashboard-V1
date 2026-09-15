package com.example.demo.service;

import com.example.demo.model.GitHubAccount;
import com.example.demo.model.OAuthState;
import com.example.demo.model.User;
import com.example.demo.repository.GitHubAccountRepository;
import com.example.demo.repository.OAuthStateRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.security.SecureRandom;
import java.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Service
public class GitHubService {

    private final GitHubAccountRepository gitHubAccountRepository;
    private final UserRepository userRepository;
    private final OAuthStateRepository oauthStateRepository;;
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
            UserRepository userRepository,
            OAuthStateRepository oauthStateRepository) {

        this.objectMapper = objectMapper;
        this.gitHubAccountRepository = gitHubAccountRepository;
        this.userRepository = userRepository;
        this.oauthStateRepository = oauthStateRepository;
    }

    public boolean validateState(String state) {

        OAuthState oauthState = oauthStateRepository
                .findById(state)
                .orElse(null);

        if (oauthState.getExpiresAt()
                .isBefore(java.time.Instant.now())){

            oauthStateRepository.deleteById(state);
            return false;
        }

        return true;
    }

    public String getUsernameForState(String state) {

        OAuthState oauthState = oauthStateRepository
                .findById(state)
                .orElseThrow(() ->
                        new RuntimeException("Invalid OAuth state"));

        return oauthState.getUsername();
    }

    public String exchangeCodeForToken(String code, String username, String state) {

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
                        .queryParam("code_verifier", getCodeVerifier(state))
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
            oauthStateRepository.deleteById(state);

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
        String codeVerifier = generateCodeVerifier();

        OAuthState oauthState = new OAuthState();
        oauthState.setState(state);
        oauthState.setUsername(username);
        oauthState.setCodeVerifier(codeVerifier);
        oauthState.setExpiresAt(
                java.time.Instant.now().plusSeconds(300)
        );

        oauthStateRepository.save(oauthState);

        return state;
    }

    public String getAuthorizationUrl(String state) {

        OAuthState oauthState = oauthStateRepository
                .findById(state)
                .orElseThrow(() ->
                        new RuntimeException("Invalid OAuth state"));

        String codeChallenge =
                generateCodeChallenge(oauthState.getCodeVerifier());

        return "https://github.com/login/oauth/authorize"
                + "?client_id=" + clientId
                + "&redirect_uri=" + redirectUri
                + "&state=" + state
                + "&code_challenge=" + codeChallenge
                + "&code_challenge_method=S256"
                + "&scope=repo"
                + "&prompt=select_account";
    }

    private String generateCodeVerifier() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);

        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(bytes);
    }

    private String generateCodeChallenge(String codeVerifier) {

        try {
            byte[] hash = MessageDigest
                    .getInstance("SHA-256")
                    .digest(codeVerifier.getBytes(StandardCharsets.UTF_8));

            return Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(hash);

        } catch (Exception e) {
            throw new RuntimeException("Failed to generate PKCE challenge", e);
        }
    }

    private String getCodeVerifier(String state) {

        OAuthState oauthState = oauthStateRepository
                .findById(state)
                .orElseThrow(() ->
                        new RuntimeException("Invalid OAuth state"));

        return oauthState.getCodeVerifier();
    }

    public void refreshAccessToken(GitHubAccount account) {

        RestClient restClient = RestClient.create();

        String response = restClient.post()
                .uri(uriBuilder -> uriBuilder
                        .scheme("https")
                        .host("github.com")
                        .path("/login/oauth/access_token")
                        .queryParam("client_id", clientId)
                        .queryParam("client_secret", clientSecret)
                        .queryParam("grant_type", "refresh_token")
                        .queryParam("refresh_token", account.getRefreshToken())
                        .build())
                .header("Accept", "application/json")
                .retrieve()
                .body(String.class);

        try {
            JsonNode json = objectMapper.readTree(response);

            String newAccessToken =
                    json.get("access_token").asText();

            String newRefreshToken =
                    json.get("refresh_token").asText();

            long expiresIn =
                    json.get("expires_in").asLong();

            account.setAccessToken(newAccessToken);
            account.setRefreshToken(newRefreshToken);
            account.setExpiresAt(
                    java.time.Instant.now().plusSeconds(expiresIn)
            );

            gitHubAccountRepository.save(account);

        } catch (Exception e) {
            throw new RuntimeException(
                    "Failed to refresh GitHub access token", e
            );
        }
    }

    public String getValidAccessToken(GitHubAccount account) {

        if (account.getExpiresAt() == null ||
                account.getExpiresAt().isAfter(java.time.Instant.now())) {

            return account.getAccessToken();
        }

        refreshAccessToken(account);

        return account.getAccessToken();
    }

}