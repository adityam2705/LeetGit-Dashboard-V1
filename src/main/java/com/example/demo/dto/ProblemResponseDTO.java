package com.example.demo.dto;

import com.example.demo.model.Difficulty;

public class ProblemResponseDTO {
    private Long id;
    private Long leetcodeId;
    private String title;
    private String slug;
    private Difficulty difficulty;

    public ProblemResponseDTO() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getLeetcodeId() {
        return leetcodeId;
    }

    public void setLeetcodeId(Long leetcodeId) {
        this.leetcodeId = leetcodeId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public Difficulty getDifficulty() {
        return difficulty;
    }

    public void setDifficulty(Difficulty difficulty) {
        this.difficulty = difficulty;
    }
}
