package com.example.demo.dto;

public class UserResponseDTO {


    private Long id;
    private String username;
    private int solved;
    private int easy;
    private int medium;
    private int hard;

    public UserResponseDTO() {
    }

    public UserResponseDTO(Long id, String username,
                           int solved, int easy, int medium, int hard) {

        this.id = id;
        this.username = username;
        this.solved = solved;
        this.easy = easy;
        this.medium = medium;
        this.hard = hard;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public int getSolved() {
        return solved;
    }

    public void setSolved(int solved) {
        this.solved = solved;
    }

    public int getEasy() {
        return easy;
    }

    public void setEasy(int easy) {
        this.easy = easy;
    }

    public int getMedium() {
        return medium;
    }

    public void setMedium(int medium) {
        this.medium = medium;
    }

    public int getHard() {
        return hard;
    }

    public void setHard(int hard) {
        this.hard = hard;}


}
