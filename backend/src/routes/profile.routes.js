const express = require("express");
const StudentProfile = require("../models/StudentProfile");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({
      userId: req.user._id,
    });

    if (!profile) {
      return res.status(404).json({
        message: "Profile not found",
      });
    }

    res.json(profile);
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.post("/", protect, async (req, res) => {
  try {
    const existingProfile = await StudentProfile.findOne({
      userId: req.user._id,
    });

    if (existingProfile) {
      return res.status(400).json({
        message: "Profile already exists",
      });
    }

    const profile = await StudentProfile.create({
      userId: req.user._id,
      grade: req.body.grade,
      favoriteSubjects: req.body.favoriteSubjects || [],
      strongSubjects: req.body.strongSubjects || [],
      interests: req.body.interests || [],
      skills: req.body.skills || [],
      goal: req.body.goal || "",
    });

    res.status(201).json({
      message: "Profile created successfully",
      profile,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.put("/", protect, async (req, res) => {
  try {
    const profile = await StudentProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        grade: req.body.grade,
        favoriteSubjects: req.body.favoriteSubjects || [],
        strongSubjects: req.body.strongSubjects || [],
        interests: req.body.interests || [],
        skills: req.body.skills || [],
        goal: req.body.goal || "",
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
      }
    );

    res.json({
      message: "Profile updated successfully",
      profile,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;