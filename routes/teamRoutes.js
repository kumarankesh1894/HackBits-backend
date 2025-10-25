const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Team = require("../models/Team");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const {
  compressAndUploadImage,
  deleteImageFromCloudinary,
  extractPublicIdFromUrl,
} = require("../utils/imageUpload");

const router = express.Router();

// Configure multer for memory storage (we'll upload directly to Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (before compression)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// @route   POST /api/teams/register
// @desc    Register a team
// @access  Private
router.post("/register", authMiddleware, async (req, res) => {
  try {
    const { teamName, members, problemStatement, teamSize } = req.body;

    // Check if team name already exists
    const existingTeamName = await Team.findOne({ teamName });
    if (existingTeamName) {
      return res
        .status(400)
        .json({
          message: "Team name already exists. Please choose a different name.",
        });
    }

    // Check if user is already in a team
    const existingTeam = await Team.findOne({
      $or: [{ leader: req.user._id }, { members: req.user._id }],
    });

    if (existingTeam) {
      return res
        .status(400)
        .json({ message: "You are already registered in a team" });
    }

    // Validate team size
    const memberCount = members ? members.length : 0;
    if (teamSize === "Solo" && memberCount > 0) {
      return res
        .status(400)
        .json({ message: "Solo teams cannot have additional members" });
    }
    if (teamSize === "Duo" && memberCount !== 1) {
      return res
        .status(400)
        .json({ message: "Duo teams must have exactly 1 additional member" });
    }
    if (teamSize === "Team" && (memberCount < 2 || memberCount > 4)) {
      return res
        .status(400)
        .json({ message: "Teams must have 2-4 additional members" });
    }

    // Verify all members exist and are not already in teams
    let memberUserIds = [];
    if (members && members.length > 0) {
      // Find users by email and registrationNumber
      const memberUsers = await User.find({
        $or: members.map((member) => ({
          email: member.email,
          registrationNumber: member.registrationNumber,
        })),
      });

      if (memberUsers.length !== members.length) {
        return res
          .status(400)
          .json({
            message:
              "One or more members not found. Please ensure all members are registered on the platform.",
          });
      }

      // Extract user IDs for team creation
      memberUserIds = memberUsers.map((user) => user._id);

      // Check if any member is already in a team
      const membersInTeams = await Team.find({
        $or: [
          { leader: { $in: memberUserIds } },
          { members: { $in: memberUserIds } },
        ],
      });

      if (membersInTeams.length > 0) {
        return res
          .status(400)
          .json({ message: "One or more members are already in a team" });
      }
    }

    // Generate unique registration number
    const teamCount = await Team.countDocuments();
    const registrationNumber = `TEAM${String(teamCount + 1).padStart(4, "0")}`;

    // Create team
    const team = new Team({
      teamName,
      leader: req.user._id,
      members: memberUserIds,
      problemStatement,
      teamSize,
      registrationNumber,
    });

    await team.save();

    // Populate team data for response
    const populatedTeam = await Team.findById(team._id)
      .populate("leader", "name email registrationNumber")
      .populate("members", "name email registrationNumber");

    res.status(201).json({
      message: "Team registered successfully",
      team: populatedTeam,
    });
  } catch (error) {
    console.error("Team registration error:", error);

    // Handle specific MongoDB errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ message: "Validation error", errors });
    }

    if (error.code === 11000) {
      return res.status(400).json({ message: "Team name already exists" });
    }

    res.status(500).json({ message: "Server error during team registration" });
  }
});

// @route   GET /api/teams
// @desc    Get all teams
// @access  Public
router.get("/", async (req, res) => {
  try {
    const teams = await Team.find({ status: "approved" })
      .populate("leader", "name email registrationNumber")
      .populate("members", "name email registrationNumber")
      .sort({ createdAt: -1 });

    res.json({ teams });
  } catch (error) {
    console.error("Get teams error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/teams/my-team
// @desc    Get current user's team
// @access  Private
router.get("/my-team", authMiddleware, async (req, res) => {
  try {
    const team = await Team.findOne({
      $or: [{ leader: req.user._id }, { members: req.user._id }],
    })
      .populate("leader", "name email registrationNumber")
      .populate("members", "name email registrationNumber");

    if (!team) {
      return res.status(404).json({ message: "No team found" });
    }

    res.json({ team });
  } catch (error) {
    console.error("Get my team error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/teams/problem-statements
// @desc    Get available problem statements
// @access  Public
router.get("/problem-statements", (req, res) => {
  const problemStatements = [
    "AI-Powered Learning Management System",
    "Smart Campus Navigation App",
    "Sustainable Energy Monitoring Platform",
    "Mental Health Support Chatbot",
    "Blockchain-based Certificate Verification",
    "IoT-based Smart Agriculture Solution",
    "AR/VR Educational Content Platform",
    "Cybersecurity Threat Detection System",
    "Social Impact Measurement Tool",
    "Digital Healthcare Management System",
    "lad chatti",
  ];

  res.json({ problemStatements });
});

// @route   POST /api/teams/upload-payment
// @desc    Upload payment screenshot for a team (compressed and uploaded to Cloudinary)
// @access  Private
router.post(
  "/upload-payment",
  authMiddleware,
  upload.single("paymentScreenshot"),
  async (req, res) => {
    try {
      const { teamId } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Find the team and verify ownership
      const team = await Team.findOne({
        _id: teamId,
        $or: [{ leader: req.user._id }, { members: req.user._id }],
      });

      if (!team) {
        return res
          .status(404)
          .json({ message: "Team not found or you are not authorized" });
      }

      // Delete old payment screenshot from Cloudinary if exists
      if (team.paymentScreenshotCloudinaryId) {
        await deleteImageFromCloudinary(team.paymentScreenshotCloudinaryId);
      }

      // Compress and upload to Cloudinary
      const uploadResult = await compressAndUploadImage(req.file, teamId);

      if (!uploadResult.success) {
        return res
          .status(500)
          .json({ message: "Failed to process and upload image" });
      }

      // Update team with new payment screenshot details
      team.paymentScreenshot = uploadResult.url;
      team.paymentScreenshotCloudinaryId = uploadResult.cloudinaryId;
      team.paymentStatus = "pending";
      await team.save();

      res.json({
        message: "Payment screenshot uploaded and compressed successfully",
        paymentScreenshot: team.paymentScreenshot,
        paymentStatus: team.paymentStatus,
        compressionInfo: {
          originalSize: uploadResult.originalSize,
          compressedSize: uploadResult.compressedSize,
          compressionRatio: uploadResult.compressionRatio + "%",
        },
      });
    } catch (error) {
      console.error("Payment upload error:", error);
      res.status(500).json({
        message: "Server error during payment upload",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

module.exports = router;
