const express = require("express");
const {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  setCourseStatus,
} = require("../controllers/courseController");
const {
  protect,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getCourses);
router.get("/:id", getCourseById);

// Protected course management routes
router.post("/", protect, authorizeRoles("teacher", "admin"), createCourse);
router.put("/:id", protect, authorizeRoles("teacher", "admin"), updateCourse);
router.delete("/:id", protect, authorizeRoles("teacher", "admin"), deleteCourse);
router.patch("/:id/status", protect, authorizeRoles("teacher", "admin"), setCourseStatus);

module.exports = router;