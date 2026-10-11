const express = require("express");
const {
  getMyEnrollments,
  enroll,
  updateProgress,
} = require("../controllers/enrollmentController");
const {
  protect,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, authorizeRoles("student"));

router.get("/", getMyEnrollments);
router.post("/", enroll);
router.patch("/:enrollmentId/progress", updateProgress);

module.exports = router;
