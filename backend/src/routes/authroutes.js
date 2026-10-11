const express = require("express");
const {
  register,
  login,
  getMe,
  logout,
} = require("../controllers/authcontroller");
const {
  protect,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

// =========================
// Public Routes
// =========================
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

router.get("/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Auth routes are operational.",
  });
});

// =========================
// Protected Routes
// =========================
router.get("/me", protect, getMe);

// Admin-only test
router.get("/admin-test", protect, authorizeRoles("admin"), (req, res) => {
  res.status(200).json({
    success: true,
    message: "Admin access verified.",
    user: req.user,
  });
});

module.exports = router;