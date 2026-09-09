package com.example.demo.model;

import jakarta.persistence.*;

@Entity
@Table(name = "problems")
public class Problem {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

        @Column(nullable = false, unique = true)
        private Long leetcodeId;

        @Column(nullable = false)
        private String title;

        @Column(nullable = false, unique = true)
        private String slug;

        @Enumerated(EnumType.STRING)
        @Column(nullable = false)
        private Difficulty difficulty;

        public Problem() {
        }

        public Long getId() {
                return id;
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