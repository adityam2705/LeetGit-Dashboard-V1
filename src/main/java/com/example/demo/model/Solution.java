package com.example.demo.model;

import jakarta.persistence.*;

@Entity
@Table(name = "solutions")
public class Solution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(
            name = "user_problem_id",
            nullable = false
    )
    private UserProblem userProblem;

    @Column(
            nullable = false,
            unique = true
    )
    private Long leetcodeSubmissionId;

    @Column(
            nullable = false,
            columnDefinition = "TEXT"
    )
    private String code;

    @Column(nullable = false)
    private String language;

    @Column(nullable = false)
    private Long submittedAt;

    private String runtime;

    private String memory;

    @Column(nullable = false)
    private String status;


    public Long getId() {
        return id;
    }


    public UserProblem getUserProblem() {
        return userProblem;
    }


    public void setUserProblem(UserProblem userProblem) {
        this.userProblem = userProblem;
    }


    public Long getLeetcodeSubmissionId() {
        return leetcodeSubmissionId;
    }


    public void setLeetcodeSubmissionId(
            Long leetcodeSubmissionId
    ) {
        this.leetcodeSubmissionId =
                leetcodeSubmissionId;
    }


    public String getCode() {
        return code;
    }


    public void setCode(String code) {
        this.code = code;
    }


    public String getLanguage() {
        return language;
    }


    public void setLanguage(String language) {
        this.language = language;
    }


    public Long getSubmittedAt() {
        return submittedAt;
    }


    public void setSubmittedAt(Long submittedAt) {
        this.submittedAt = submittedAt;
    }


    public String getRuntime() {
        return runtime;
    }


    public void setRuntime(String runtime) {
        this.runtime = runtime;
    }


    public String getMemory() {
        return memory;
    }


    public void setMemory(String memory) {
        this.memory = memory;
    }


    public String getStatus() {
        return status;
    }


    public void setStatus(String status) {
        this.status = status;
    }
}