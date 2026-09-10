package com.example.demo.dto;

public class GitHubRepositoryRequestDTO {
    private String owner;
    private String repository;

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }

    public String getRepository() {
        return repository;
    }

    public void setRepository(String repository) {
        this.repository = repository;
    }

}
