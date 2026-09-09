package com.example.demo.service;

import com.example.demo.model.GitHubAccount;
import com.example.demo.repository.GitHubAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import com.example.demo.model.Solution;
import com.example.demo.model.Problem;

@Service
public class GitHubApiService {

    private final GitHubAccountRepository gitHubAccountRepository;

    public GitHubApiService(
            GitHubAccountRepository gitHubAccountRepository) {
        this.gitHubAccountRepository = gitHubAccountRepository;
    }

    public GitHubAccount getGitHubAccount(String username) {

        return gitHubAccountRepository
                .findByUser_Username(username)
                .orElseThrow(() ->
                        new RuntimeException("GitHub account not connected"));
    }

    public String getAccessToken(String username) {

        GitHubAccount account = getGitHubAccount(username);

        return account.getAccessToken();
    }

    public String getAuthenticatedUser(String username) {

        String accessToken = getAccessToken(username);

        RestClient restClient = RestClient.create();

        return restClient.get()
                .uri("https://api.github.com/user")
                .header("Authorization", "Bearer " + accessToken)
                .header("Accept", "application/vnd.github+json")
                .retrieve()
                .body(String.class);
    }

    public String getRepositoryContents(
            String username,
            String owner,
            String repository) {

        String accessToken = getAccessToken(username);

        RestClient restClient = RestClient.create();

        return restClient.get()
                .uri("https://api.github.com/repos/"
                        + owner + "/"
                        + repository + "/contents/")
                .header("Authorization", "Bearer " + accessToken)
                .header("Accept", "application/vnd.github+json")
                .retrieve()
                .body(String.class);
    }

    private String getFileExtension(String language) {

        return switch (language.toLowerCase()) {
            case "java" -> "java";
            case "python" -> "py";
            case "cpp" -> "cpp";
            case "c" -> "c";
            case "javascript" -> "js";
            case "typescript" -> "ts";
            case "kotlin" -> "kt";
            case "go" -> "go";
            case "rust" -> "rs";
            case "swift" -> "swift";
            default -> throw new RuntimeException(
                    "Unsupported language: " + language
            );
        };
    }

    private String buildSolutionPath(Solution solution) {

        Problem problem =
                solution.getUserProblem().getProblem();

        String difficulty =
                problem.getDifficulty().name().toLowerCase();

        String extension =
                getFileExtension(solution.getLanguage());

        return difficulty
                + "/"
                + problem.getLeetcodeId()
                + "-"
                + problem.getSlug()
                + "."
                + extension;
    }

    public String createSolutionFile(
            String username,
            Solution solution) {

        String accessToken = getAccessToken(username);

        String path = buildSolutionPath(solution);

        String encodedContent =
                Base64.getEncoder()
                        .encodeToString(
                                solution.getCode()
                                        .getBytes(
                                                java.nio.charset.StandardCharsets.UTF_8
                                        )
                        );

        Map<String, Object> body = new HashMap<>();

        body.put("message",
                "Add LeetCode " +
                        solution.getUserProblem()
                                .getProblem()
                                .getLeetcodeId());

        body.put("content", encodedContent);

        RestClient restClient = RestClient.create();

        return restClient.put()
                .uri("https://api.github.com/repos/"
                        + "adityam2705"
                        + "/leetcode-solutions"
                        + "/contents/"
                        + path)
                .header("Authorization", "Bearer " + accessToken)
                .header("Accept", "application/vnd.github+json")
                .body(body)
                .retrieve()
                .body(String.class);
    }
}