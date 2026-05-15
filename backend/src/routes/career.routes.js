const express = require("express");
const Career = require("../models/Career");
const { protect, adminOnly } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { search, field } = req.query;

    const filter = {};

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (field) {
      filter.field = field;
    }

    const careers = await Career.find(filter).sort({ createdAt: -1 });

    res.json(careers);
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const career = await Career.findById(req.params.id);

    if (!career) {
      return res.status(404).json({
        message: "Career not found",
      });
    }

    res.json(career);
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const career = await Career.create(req.body);

    res.status(201).json({
      message: "Career created successfully",
      career,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const career = await Career.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!career) {
      return res.status(404).json({
        message: "Career not found",
      });
    }

    res.json({
      message: "Career updated successfully",
      career,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const career = await Career.findByIdAndDelete(req.params.id);

    if (!career) {
      return res.status(404).json({
        message: "Career not found",
      });
    }

    res.json({
      message: "Career deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;