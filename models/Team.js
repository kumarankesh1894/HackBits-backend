const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    teamName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    leader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    problemStatement: {
      type: String,
      required: true,
    },
    teamSize: {
      type: String,
      enum: ["Solo", "Duo", "Team"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
    },
    paymentScreenshot: {
      type: String, // Cloudinary URL to the uploaded payment screenshot
      default: null,
    },
    paymentScreenshotCloudinaryId: {
      type: String, // Cloudinary public ID for easy deletion
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Team", teamSchema);
