package com.example.demo.service;

import com.example.demo.dto.GitHubRepositoryRequestDTO;
import com.example.demo.model.GitHubAccount;
import com.example.demo.model.Solution;
import com.example.demo.model.Problem;
import com.example.demo.model.User;
import com.example.demo.model.UserProblem;
import com.example.demo.repository.GitHubAccountRepository;
import com.example.demo.repository.SolutionRepository;
import com.example.demo.repository.UserProblemRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;

import java.util.*;

@Service
public class GitHubApiService {

    private final GitHubAccountRepository gitHubAccountRepository;
    private final GitHubService gitHubService;
    private final SolutionRepository solutionRepository;
    private final UserProblemRepository userProblemRepository;

    public GitHubApiService(
            GitHubAccountRepository gitHubAccountRepository,
            GitHubService gitHubService,
            SolutionRepository solutionRepository,
            UserProblemRepository userProblemRepository) {

        this.gitHubAccountRepository = gitHubAccountRepository;
        this.gitHubService = gitHubService;
        this.solutionRepository = solutionRepository;
        this.userProblemRepository = userProblemRepository;
    }


    // =========================================================
    // REAL BULK SYNC
    // =========================================================

    public String syncPendingSolutions(
            String username) {

        long totalStart =
                System.nanoTime();

        // ---------------------------------------------------------
        // 1. GET UNSYNCED USER PROBLEMS FROM DATABASE
        // ---------------------------------------------------------

        User user =
                getUserForUsername(username);

        List<UserProblem> pendingUserProblems =
                userProblemRepository
                        .findByUserAndGithubSyncedFalse(user);

        if (pendingUserProblems.isEmpty()) {
            return "No pending solutions to sync";
        }


        // ---------------------------------------------------------
        // 2. GET SOLUTIONS FOR THOSE USER PROBLEMS
        // ---------------------------------------------------------

        List<Solution> pendingSolutions =
                new ArrayList<>();

        for (UserProblem userProblem :
                pendingUserProblems) {

            Solution solution =
                    solutionRepository
                            .findByUserProblem(userProblem)
                            .orElseThrow(() ->
                                    new RuntimeException(
                                            "No solution found for problem "
                                                    + userProblem
                                                    .getProblem()
                                                    .getLeetcodeId()
                                    )
                            );

            pendingSolutions.add(solution);
        }


        try {

            // -----------------------------------------------------
            // 3. LOAD CURRENT GITHUB STATE ONCE
            // -----------------------------------------------------

            long start =
                    System.nanoTime();

            GitHubBranchState state;

            try {

                state =
                        getCurrentBranchState(username);

            } catch (HttpClientErrorException e) {

                /*
                 * An empty GitHub repository has no commit yet.
                 *
                 * GitHub returns 409 when we request the current
                 * commit of the default branch.
                 *
                 * Initialize the repository using the Contents API.
                 */

                if (e.getStatusCode() == HttpStatus.CONFLICT
                        && e.getResponseBodyAsString()
                        .contains("Git Repository is empty")) {

                    System.out.println(
                            "GITHUB REPOSITORY IS EMPTY - initializing repository."
                    );

                    initializeEmptyRepository(
                            username
                    );

                    /*
                     * The Contents API created the first commit.
                     *
                     * The repository is now initialized, so reload
                     * the branch state and continue through the
                     * normal bulk Git Trees flow.
                     */

                    state =
                            getCurrentBranchState(username);

                } else {

                    throw e;
                }
            }

            long end =
                    System.nanoTime();

            System.out.println(
                    "TIME getCurrentBranchState = "
                            + ((end - start) / 1_000_000)
                            + " ms"
            );


            // -----------------------------------------------------
            // 4. CREATE ONE BULK TREE
            // -----------------------------------------------------

            start =
                    System.nanoTime();

            String newTreeResponse =
                    createBulkTree(
                            state,
                            pendingSolutions
                    );

            end =
                    System.nanoTime();

            System.out.println(
                    "TIME createBulkTree = "
                            + ((end - start) / 1_000_000)
                            + " ms"
            );


            // -----------------------------------------------------
            // 5. GET NEW TREE SHA
            // -----------------------------------------------------

            com.fasterxml.jackson.databind.ObjectMapper mapper =
                    new com.fasterxml.jackson.databind.ObjectMapper();

            String newTreeSha =
                    mapper.readTree(newTreeResponse)
                            .get("sha")
                            .asText();


            // -----------------------------------------------------
            // 6. CREATE ONE COMMIT
            // -----------------------------------------------------

            start =
                    System.nanoTime();

            String newCommitResponse =
                    createCommit(
                            state,
                            newTreeSha
                    );

            end =
                    System.nanoTime();

            System.out.println(
                    "TIME createCommit = "
                            + ((end - start) / 1_000_000)
                            + " ms"
            );


            // -----------------------------------------------------
            // 7. GET NEW COMMIT SHA
            // -----------------------------------------------------

            String newCommitSha =
                    mapper.readTree(newCommitResponse)
                            .get("sha")
                            .asText();


            // -----------------------------------------------------
            // 8. UPDATE BRANCH
            // -----------------------------------------------------

            start =
                    System.nanoTime();

            String result =
                    updateBranch(
                            state,
                            newCommitSha
                    );

            end =
                    System.nanoTime();

            System.out.println(
                    "TIME updateBranch = "
                            + ((end - start) / 1_000_000)
                            + " ms"
            );


            // -----------------------------------------------------
            // 9. ONLY AFTER SUCCESSFUL BRANCH UPDATE
            //    MARK USER PROBLEMS AS GITHUB SYNCED
            // -----------------------------------------------------

            for (UserProblem userProblem :
                    pendingUserProblems) {

                userProblem.setGithubSynced(true);
            }

            userProblemRepository.saveAll(
                    pendingUserProblems
            );


            // -----------------------------------------------------
            // TOTAL
            // -----------------------------------------------------

            long totalEnd =
                    System.nanoTime();

            System.out.println(
                    "TIME TOTAL = "
                            + ((totalEnd - totalStart)
                            / 1_000_000)
                            + " ms"
            );


            return result;


        } catch (Exception e) {

            /*
             * If any GitHub operation fails before the
             * branch update succeeds, githubSynced remains
             * false.
             *
             * Therefore these problems can be retried
             * on the next sync.
             */

            throw new RuntimeException(
                    "Bulk GitHub sync failed",
                    e
            );
        }
    }


    // =========================================================
    // INITIALIZE EMPTY GITHUB REPOSITORY
    // =========================================================

    private void initializeEmptyRepository(
            String username) {

        GitHubAccount account =
                getGitHubAccount(username);

        String accessToken =
                gitHubService.getValidAccessToken(account);

        String owner =
                account.getRepositoryOwner();

        String repository =
                account.getRepositoryName();

        String branch =
                getRepositoryDefaultBranch(
                        owner,
                        repository,
                        accessToken
                );

        /*
         * GitHub does not allow creating a Git reference
         * in a completely empty repository.
         *
         * Therefore we initialize the repository through
         * the Contents API.
         *
         * The .gitkeep file creates the initial easy/
         * directory and establishes the first commit.
         *
         * After this, the normal Git Trees API bulk-sync
         * flow can safely be used.
         */

        String path =
                "easy/.gitkeep";

        String encodedContent =
                Base64.getEncoder()
                        .encodeToString(
                                new byte[0]
                        );

        Map<String, Object> body =
                new HashMap<>();

        body.put(
                "message",
                "Initialize LeetGit repository"
        );

        body.put(
                "content",
                encodedContent
        );

        body.put(
                "branch",
                branch
        );

        RestClient restClient =
                RestClient.create();

        System.out.println(
                "GITHUB REPOSITORY IS EMPTY"
        );

        System.out.println(
                "GITHUB INITIALIZING REPOSITORY"
        );

        System.out.println(
                "GITHUB INITIALIZATION PATH = "
                        + path
        );

        restClient.put()
                .uri(
                        "https://api.github.com/repos/"
                                + owner
                                + "/"
                                + repository
                                + "/contents/"
                                + path
                )
                .header(
                        "Authorization",
                        "Bearer " + accessToken
                )
                .header(
                        "Accept",
                        "application/vnd.github+json"
                )
                .body(body)
                .retrieve()
                .body(String.class);

        System.out.println(
                "GITHUB EMPTY REPOSITORY INITIALIZED"
        );
    }


    // =========================================================
    // GET REPOSITORY DEFAULT BRANCH
    // =========================================================

    private String getRepositoryDefaultBranch(
            String owner,
            String repository,
            String accessToken) {

        RestClient restClient =
                RestClient.create();

        String response =
                restClient.get()
                        .uri(
                                "https://api.github.com/repos/"
                                        + owner
                                        + "/"
                                        + repository
                        )
                        .header(
                                "Authorization",
                                "Bearer " + accessToken
                        )
                        .header(
                                "Accept",
                                "application/vnd.github+json"
                        )
                        .retrieve()
                        .body(String.class);

        try {

            com.fasterxml.jackson.databind.ObjectMapper mapper =
                    new com.fasterxml.jackson.databind.ObjectMapper();

            return mapper.readTree(response)
                    .get("default_branch")
                    .asText();

        } catch (Exception e) {

            throw new RuntimeException(
                    "Failed to get GitHub default branch",
                    e
            );
        }
    }


    // =========================================================
    // GET USER
    // =========================================================

    private User getUserForUsername(
            String username) {

        return gitHubAccountRepository
                .findByUser_Username(username)
                .orElseThrow(() ->
                        new RuntimeException(
                                "GitHub account not connected"
                        )
                )
                .getUser();
    }


    // =========================================================
    // BULK SYNC TEST
    // =========================================================

    public String testBulkSync(
            String username,
            List<Long> solutionIds) {

        long totalStart =
                System.nanoTime();

        List<Solution> solutions =
                solutionRepository.findAllById(
                        solutionIds
                );

        if (solutions.isEmpty()) {
            throw new RuntimeException(
                    "No solutions found"
            );
        }

        try {

            // -------------------------------------------------
            // 1. LOAD GITHUB STATE ONCE
            // -------------------------------------------------

            long start =
                    System.nanoTime();

            GitHubBranchState state =
                    getCurrentBranchState(username);

            long end =
                    System.nanoTime();

            System.out.println(
                    "TIME getCurrentBranchState = "
                            + ((end - start) / 1_000_000)
                            + " ms"
            );


            // -------------------------------------------------
            // 4. CREATE ONE BULK TREE
            // -------------------------------------------------

            start =
                    System.nanoTime();

            String newTreeResponse =
                    createBulkTree(
                            state,
                            solutions
                    );

            end =
                    System.nanoTime();

            System.out.println(
                    "TIME createBulkTree = "
                            + ((end - start) / 1_000_000)
                            + " ms"
            );


            // -------------------------------------------------
            // 5. CREATE ONE COMMIT
            // -------------------------------------------------

            com.fasterxml.jackson.databind.ObjectMapper mapper =
                    new com.fasterxml.jackson.databind.ObjectMapper();

            String newTreeSha =
                    mapper.readTree(newTreeResponse)
                            .get("sha")
                            .asText();

            start =
                    System.nanoTime();

            String newCommitResponse =
                    createCommit(
                            state,
                            newTreeSha
                    );

            end =
                    System.nanoTime();

            System.out.println(
                    "TIME createCommit = "
                            + ((end - start) / 1_000_000)
                            + " ms"
            );


            // -------------------------------------------------
            // 6. UPDATE DEFAULT BRANCH
            // -------------------------------------------------

            String newCommitSha =
                    mapper.readTree(newCommitResponse)
                            .get("sha")
                            .asText();

            start =
                    System.nanoTime();

            String result =
                    updateBranch(
                            state,
                            newCommitSha
                    );

            end =
                    System.nanoTime();

            System.out.println(
                    "TIME updateBranch = "
                            + ((end - start) / 1_000_000)
                            + " ms"
            );


            // -------------------------------------------------
            // TOTAL
            // -------------------------------------------------

            long totalEnd =
                    System.nanoTime();

            System.out.println(
                    "TIME TOTAL = "
                            + ((totalEnd - totalStart)
                            / 1_000_000)
                            + " ms"
            );


            return result;

        } catch (Exception e) {

            throw new RuntimeException(
                    "Bulk GitHub sync failed",
                    e
            );
        }
    }


    // =========================================================
    // GITHUB BRANCH STATE
    // =========================================================

    private static class GitHubBranchState {

        private final String accessToken;
        private final String owner;
        private final String repository;
        private final String branch;
        private final String commitSha;
        private final String treeSha;

        private GitHubBranchState(
                String accessToken,
                String owner,
                String repository,
                String branch,
                String commitSha,
                String treeSha) {

            this.accessToken = accessToken;
            this.owner = owner;
            this.repository = repository;
            this.branch = branch;
            this.commitSha = commitSha;
            this.treeSha = treeSha;
        }
    }


    // =========================================================
    // GET CURRENT GITHUB STATE
    // =========================================================

    private GitHubBranchState getCurrentBranchState(
            String username) {

        GitHubAccount account =
                getGitHubAccount(username);

        String accessToken =
                gitHubService.getValidAccessToken(account);

        String owner =
                account.getRepositoryOwner();

        String repository =
                account.getRepositoryName();

        RestClient restClient =
                RestClient.create();


        // -----------------------------------------------------
        // GET REPOSITORY
        // -----------------------------------------------------

        String repoResponse =
                restClient.get()
                        .uri(
                                "https://api.github.com/repos/"
                                        + owner
                                        + "/"
                                        + repository
                        )
                        .header(
                                "Authorization",
                                "Bearer " + accessToken
                        )
                        .header(
                                "Accept",
                                "application/vnd.github+json"
                        )
                        .retrieve()
                        .body(String.class);

        try {

            com.fasterxml.jackson.databind.ObjectMapper mapper =
                    new com.fasterxml.jackson.databind.ObjectMapper();

            com.fasterxml.jackson.databind.JsonNode repoJson =
                    mapper.readTree(repoResponse);

            String defaultBranch =
                    repoJson
                            .get("default_branch")
                            .asText();


            // -------------------------------------------------
            // GET CURRENT COMMIT
            // -------------------------------------------------

            String commitResponse =
                    restClient.get()
                            .uri(
                                    "https://api.github.com/repos/"
                                            + owner
                                            + "/"
                                            + repository
                                            + "/commits/"
                                            + defaultBranch
                            )
                            .header(
                                    "Authorization",
                                    "Bearer " + accessToken
                            )
                            .header(
                                    "Accept",
                                    "application/vnd.github+json"
                            )
                            .retrieve()
                            .body(String.class);

            com.fasterxml.jackson.databind.JsonNode commitJson =
                    mapper.readTree(commitResponse);

            String commitSha =
                    commitJson
                            .get("sha")
                            .asText();

            String treeSha =
                    commitJson
                            .get("commit")
                            .get("tree")
                            .get("sha")
                            .asText();

            return new GitHubBranchState(
                    accessToken,
                    owner,
                    repository,
                    defaultBranch,
                    commitSha,
                    treeSha
            );

        } catch (HttpClientErrorException e) {

            /*
             * Preserve GitHub HTTP errors.
             *
             * In particular, the 409 returned for an empty
             * repository must reach syncPendingSolutions(),
             * where it is handled explicitly.
             */

            throw e;

        } catch (Exception e) {

            throw new RuntimeException(
                    "Failed to get current GitHub branch state",
                    e
            );
        }
    }


    // =========================================================
    // ACCOUNT / TOKEN
    // =========================================================

    public GitHubAccount getGitHubAccount(
            String username) {

        return gitHubAccountRepository
                .findByUser_Username(username)
                .orElseThrow(() ->
                        new RuntimeException(
                                "GitHub account not connected"
                        )
                );
    }


    public String getAccessToken(
            String username) {

        GitHubAccount account =
                getGitHubAccount(username);

        return gitHubService
                .getValidAccessToken(account);
    }


    // =========================================================
    // AUTHENTICATED GITHUB USER
    // =========================================================

    public String getAuthenticatedUser(
            String username) {

        String accessToken =
                getAccessToken(username);

        RestClient restClient =
                RestClient.create();

        return restClient.get()
                .uri(
                        "https://api.github.com/user"
                )
                .header(
                        "Authorization",
                        "Bearer " + accessToken
                )
                .header(
                        "Accept",
                        "application/vnd.github+json"
                )
                .retrieve()
                .body(String.class);
    }


    // =========================================================
    // REPOSITORY CONTENTS
    // =========================================================

    public String getRepositoryContents(
            String username) {

        String accessToken =
                getAccessToken(username);

        GitHubAccount account =
                getGitHubAccount(username);

        String owner =
                account.getRepositoryOwner();

        String repository =
                account.getRepositoryName();

        RestClient restClient =
                RestClient.create();

        return restClient.get()
                .uri(
                        "https://api.github.com/repos/"
                                + owner
                                + "/"
                                + repository
                                + "/contents/"
                )
                .header(
                        "Authorization",
                        "Bearer " + accessToken
                )
                .header(
                        "Accept",
                        "application/vnd.github+json"
                )
                .retrieve()
                .body(String.class);
    }


    // =========================================================
    // FILE EXTENSION
    // =========================================================

    private String getFileExtension(
            String language) {

        return switch (language.toLowerCase()) {

            case "java" ->
                    "java";

            case "python" ->
                    "py";

            case "cpp" ->
                    "cpp";

            case "c" ->
                    "c";

            case "javascript" ->
                    "js";

            case "typescript" ->
                    "ts";

            case "kotlin" ->
                    "kt";

            case "go" ->
                    "go";

            case "rust" ->
                    "rs";

            case "swift" ->
                    "swift";

            default ->
                    throw new RuntimeException(
                            "Unsupported language: "
                                    + language
                    );
        };
    }


    // =========================================================
    // BUILD SOLUTION PATH
    // =========================================================

    private String buildSolutionPath(
            Solution solution) {

        Problem problem =
                solution
                        .getUserProblem()
                        .getProblem();

        String difficulty =
                problem
                        .getDifficulty()
                        .name()
                        .toLowerCase();

        String extension =
                getFileExtension(
                        solution.getLanguage()
                );

        return difficulty
                + "/"
                + problem.getLeetcodeId()
                + "-"
                + problem.getSlug()
                + "."
                + extension;
    }


    // =========================================================
    // BULK TREE
    // =========================================================

    public String createBulkTree(
            String username,
            List<Solution> solutions,
            String baseTreeSha) {

        GitHubBranchState state =
                getCurrentBranchState(username);

        return createBulkTree(
                state,
                solutions
        );
    }


    private String createBulkTree(
            GitHubBranchState state,
            List<Solution> solutions) {

        RestClient restClient =
                RestClient.create();

        List<Map<String, Object>> tree =
                new ArrayList<>();

        for (Solution solution :
                solutions) {

            String path =
                    buildSolutionPath(solution);

            Map<String, Object> file =
                    new HashMap<>();

            file.put(
                    "path",
                    path
            );

            file.put(
                    "mode",
                    "100644"
            );

            file.put(
                    "type",
                    "blob"
            );

            file.put(
                    "content",
                    solution.getCode()
            );

            tree.add(file);
        }

        System.out.println(
                "GITHUB BULK TREE FILE COUNT = "
                        + tree.size()
        );

        if (!tree.isEmpty()) {

            System.out.println(
                    "GITHUB FIRST FILE PATH = "
                            + tree.get(0).get("path")
            );

            System.out.println(
                    "GITHUB LAST FILE PATH = "
                            + tree.get(tree.size() - 1).get("path")
            );
        }

        Map<String, Object> body =
                new HashMap<>();

        body.put(
                "base_tree",
                state.treeSha
        );

        body.put(
                "tree",
                tree
        );

        System.out.println(
                "GITHUB BASE TREE SHA = "
                        + state.treeSha
        );

        String response =
                restClient.post()
                        .uri(
                                "https://api.github.com/repos/"
                                        + state.owner
                                        + "/"
                                        + state.repository
                                        + "/git/trees"
                        )
                        .header(
                                "Authorization",
                                "Bearer " + state.accessToken
                        )
                        .header(
                                "Accept",
                                "application/vnd.github+json"
                        )
                        .body(body)
                        .retrieve()
                        .body(String.class);

        System.out.println(
                "GITHUB CREATE TREE RESPONSE = "
                        + response
        );

        return response;
    }


    // =========================================================
    // CREATE COMMIT
    // =========================================================

    private String createCommit(
            GitHubBranchState state,
            String treeSha) {

        RestClient restClient =
                RestClient.create();

        Map<String, Object> body =
                new HashMap<>();

        body.put(
                "message",
                "Sync LeetCode solutions"
        );

        body.put(
                "tree",
                treeSha
        );

        body.put(
                "parents",
                List.of(state.commitSha)
        );

        System.out.println(
                "GITHUB CREATE COMMIT TREE SHA = "
                        + treeSha
        );

        System.out.println(
                "GITHUB CREATE COMMIT PARENT SHA = "
                        + state.commitSha
        );

        String response =
                restClient.post()
                        .uri(
                                "https://api.github.com/repos/"
                                        + state.owner
                                        + "/"
                                        + state.repository
                                        + "/git/commits"
                        )
                        .header(
                                "Authorization",
                                "Bearer " + state.accessToken
                        )
                        .header(
                                "Accept",
                                "application/vnd.github+json"
                        )
                        .body(body)
                        .retrieve()
                        .body(String.class);

        System.out.println(
                "GITHUB CREATE COMMIT RESPONSE = "
                        + response
        );

        return response;
    }


    // =========================================================
    // UPDATE BRANCH
    // =========================================================

    public String updateBranch(
            String username,
            String commitSha) {

        GitHubBranchState state =
                getCurrentBranchState(username);

        return updateBranch(
                state,
                commitSha
        );
    }


    private String updateBranch(
            GitHubBranchState state,
            String commitSha) {

        RestClient restClient =
                RestClient.create();

        Map<String, Object> body =
                new HashMap<>();

        body.put(
                "sha",
                commitSha
        );

        return restClient.patch()
                .uri(
                        "https://api.github.com/repos/"
                                + state.owner
                                + "/"
                                + state.repository
                                + "/git/refs/heads/"
                                + state.branch
                )
                .header(
                        "Authorization",
                        "Bearer " + state.accessToken
                )
                .header(
                        "Accept",
                        "application/vnd.github+json"
                )
                .body(body)
                .retrieve()
                .body(String.class);
    }


    // =========================================================
    // CURRENT COMMIT
    // =========================================================

    public String getCurrentCommitSha(
            String username) {

        GitHubBranchState state =
                getCurrentBranchState(username);

        return state.commitSha;
    }


    // =========================================================
    // CURRENT TREE
    // =========================================================

    public String getCurrentTreeSha(
            String username) {

        GitHubBranchState state =
                getCurrentBranchState(username);

        return state.treeSha;
    }


    // =========================================================
    // GITHUB CONNECTION
    // =========================================================

    public boolean isGitHubConnected(
            String username) {

        return gitHubAccountRepository
                .findByUser_Username(username)
                .isPresent();
    }


    // =========================================================
    // GET REPOSITORIES
    // =========================================================

    public String getRepositories(
            String username) {

        String accessToken =
                getAccessToken(username);

        RestClient restClient =
                RestClient.create();

        return restClient.get()
                .uri(
                        "https://api.github.com/user/repos"
                )
                .header(
                        "Authorization",
                        "Bearer " + accessToken
                )
                .header(
                        "Accept",
                        "application/vnd.github+json"
                )
                .retrieve()
                .body(String.class);
    }


    // =========================================================
    // SELECT REPOSITORY
    // =========================================================

    public String selectRepository(
            String username,
            GitHubRepositoryRequestDTO request) {

        GitHubAccount account =
                getGitHubAccount(username);

        account.setRepositoryOwner(
                request.getOwner()
        );

        account.setRepositoryName(
                request.getRepository()
        );

        gitHubAccountRepository.save(
                account
        );

        return "Repository selected successfully";
    }
}