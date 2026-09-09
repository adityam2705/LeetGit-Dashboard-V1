package com.example.demo.dto;

public class SolutionRequestDTO {

    private Long leetcodeSubmissionId;
    private String code;
    private String language;
    private Long submittedAt;
    private String runtime;
    private String memory;
    private String status;

    public SolutionRequestDTO() {
    }

    public Long getLeetcodeSubmissionId() {
        return leetcodeSubmissionId;
    }

    public void setLeetcodeSubmissionId(Long leetcodeSubmissionId) {
        this.leetcodeSubmissionId = leetcodeSubmissionId;
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
