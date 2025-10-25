const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Team = require('../models/Team');
const User = require('../models/User');

const router = express.Router();

// Admin authentication middleware
const adminAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.adminId).select('-password');
    
    if (!admin) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// @route   POST /api/admin/login
// @desc    Admin login
// @access  Private (only accessible via direct link)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find admin by username
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Create JWT token
    const payload = {
      adminId: admin._id,
      username: admin.username,
      role: admin.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      message: 'Admin login successful',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
        lastLogin: admin.lastLogin
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error during admin login' });
  }
});

// @route   GET /api/admin/teams
// @desc    Get all teams with payment details
// @access  Private (Admin only)
router.get('/teams', adminAuthMiddleware, async (req, res) => {
  try {
    const teams = await Team.find()
      .populate('leader', 'name email registrationNumber')
      .populate('members', 'name email registrationNumber')
      .sort({ createdAt: -1 });

    res.json({ teams });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/teams/:teamId/payment-status
// @desc    Update team payment status
// @access  Private (Admin only)
router.put('/teams/:teamId/payment-status', adminAuthMiddleware, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { paymentStatus } = req.body;

    if (!['pending', 'verified', 'rejected'].includes(paymentStatus)) {
      return res.status(400).json({ message: 'Invalid payment status' });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    team.paymentStatus = paymentStatus;
    await team.save();

    // Populate team data for response
    const updatedTeam = await Team.findById(team._id)
      .populate('leader', 'name email registrationNumber')
      .populate('members', 'name email registrationNumber');

    res.json({
      message: 'Payment status updated successfully',
      team: updatedTeam
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/change-password
// @desc    Change admin password
// @access  Private (Admin only)
router.put('/change-password', adminAuthMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Find admin
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Verify current password
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/stats
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/stats', adminAuthMiddleware, async (req, res) => {
  try {
    const totalTeams = await Team.countDocuments();
    const verifiedPayments = await Team.countDocuments({ paymentStatus: 'verified' });
    const pendingPayments = await Team.countDocuments({ paymentStatus: 'pending' });
    const rejectedPayments = await Team.countDocuments({ paymentStatus: 'rejected' });
    const totalUsers = await User.countDocuments();

    res.json({
      stats: {
        totalTeams,
        verifiedPayments,
        pendingPayments,
        rejectedPayments,
        totalUsers,
        paymentVerificationRate: totalTeams > 0 ? ((verifiedPayments / totalTeams) * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
