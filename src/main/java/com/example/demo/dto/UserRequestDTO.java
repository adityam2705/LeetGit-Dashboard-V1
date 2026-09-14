package com.example.demo.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public class UserRequestDTO {

    @NotBlank
    @Size(min = 3, max = 20)
    private String username;

    @Min(0)
    private int solved;

    @Min(0)
    private int easy;

    @Min(0)
    private int medium;

    @Min(0)
    private int hard;

    private String password;

    public UserRequestDTO() {
    }

    public UserRequestDTO(String username,int solved,int easy,int medium,int hard) {
        this.username = username;
        this.solved=solved;
        this.easy=easy;
        this.medium=medium;
        this.hard=hard;
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

    public void setMedium(int medium) {
        this.medium = medium;
    }
    public int getMedium() {
        return medium;
    }

    public int getHard() {
        return hard;
    }

    public void setHard(int hard) {
        this.hard = hard;}

    public String getPassword() {return password;}

    public void setPassword(String password) {this.password = password;}
}
