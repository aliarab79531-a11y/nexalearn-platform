const express = require("express");
const {
  getTeacherCourses,
  getTeacherOverview,
} = require("../controllers/teacherController");
const {
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

router.use(protect, authorizeRoles("teacher", "admin"));

router.get("/courses", getTeacherCourses);
router.get("/overview", getTeacherOverview);
router.post("/courses", createCourse);
router.put("/courses/:id", updateCourse);
router.patch("/courses/:id/status", setCourseStatus);
router.delete("/courses/:id", deleteCourse);

module.exports = router;
