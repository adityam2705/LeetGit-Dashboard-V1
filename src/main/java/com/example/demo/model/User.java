package com.example.demo.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.persistence.OneToOne;
import jakarta.persistence.CascadeType;

@Entity
@Table(name = "users")
public class User{

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private GitHubAccount gitHubAccount;

    @NotBlank
    @Size(min = 6, max = 100)
    private String password;

    @Column(length = 500)
    private String refreshToken;

    private String username;
    private String email;
    private int solved;
    private int easy;
    private int medium;
    private int hard;

    public User() {
    }

    public User(String username,String email, int solved, int easy, int medium, int hard) {
        this.username = username;
        this.email=email;
        this.solved = solved;
        this.easy = easy;
        this.medium = medium;
        this.hard = hard;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public int getSolved() {
        return solved;
    }

    public int getEasy() {
        return easy;
    }

    public int getMedium() {
        return medium;
    }

    public int getHard() {
        return hard;
    }

    public String getEmail() {return email;}

    public void set() {
    }

    public void setUsername(String username) {
        this.username=username;
    }

    public void setSolved(int solved) {
        this.solved = solved;
    }

    public void setEasy(int easy) {
        this.easy = easy;
    }

    public void setMedium(int medium) {
        this.medium = medium;
    }

    public void setHard(int hard) {
        this.hard = hard;
    }

    public void setEmail(String email) {
        this.email=email;
    }

    public String getPassword() {return password;}

    public void setPassword(String password) {
        this.password = password;
    }

    public GitHubAccount getGitHubAccount() {
        return gitHubAccount;
    }

    public void setGitHubAccount(GitHubAccount gitHubAccount) {
        this.gitHubAccount = gitHubAccount;}

    public String getRefreshToken() {
        return refreshToken;}

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;}
}
