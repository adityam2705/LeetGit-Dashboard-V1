package com.example.demo.model;

import jakarta.persistence.*;

@Entity
@Table(
        name = "user_problems",
        uniqueConstraints = {
                @UniqueConstraint(
                        columnNames = {"user_id", "problem_id"}
                )
        }
)
public class UserProblem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(
            name = "user_id",
            nullable = false
    )
    private User user;

    @ManyToOne
    @JoinColumn(
            name = "problem_id",
            nullable = false
    )
    private Problem problem;

    @Column(
            nullable = false
    )
    private boolean githubSynced = false;


    public Long getId() {
        return id;
    }


    public User getUser() {
        return user;
    }


    public void setUser(User user) {
        this.user = user;
    }


    public Problem getProblem() {
        return problem;
    }


    public void setProblem(Problem problem) {
        this.problem = problem;
    }


    public boolean isGithubSynced() {
        return githubSynced;
    }


    public void setGithubSynced(boolean githubSynced) {
        this.githubSynced = githubSynced;
    }
}