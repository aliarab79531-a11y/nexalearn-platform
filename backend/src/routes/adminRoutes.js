const express = require("express");
const {
  getAdminOverview,
  getAdminUsers,
  updateUserStatus,
  updateUserRole,
  getAuditLog,
} = require("../controllers/adminController");
const {
  protect,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, authorizeRoles("admin"));

router.get("/overview", getAdminOverview);
router.get("/users", getAdminUsers);
router.patch("/users/:userId/status", updateUserStatus);
router.patch("/users/:userId/role", updateUserRole);
router.get("/audit-log", getAuditLog);

module.exports = router;
