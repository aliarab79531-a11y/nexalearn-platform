const { collection } = require("../config/db");
const ObjectId = require("../utils/objectId");

const getMyEnrollments = async (req, res, next) => {
  try {
    const studentId = new ObjectId(req.user.id);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const enrollmentsCol = collection("enrollments");
    const [rows, total] = await Promise.all([
      enrollmentsCol.find({ studentId }).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
      enrollmentsCol.countDocuments({ studentId }),
    ]);

    const courseIds = rows.map((r) => r.courseId).filter(Boolean);
    const courses = courseIds.length
      ? await collection("courses").find({ _id: { $in: courseIds } }).toArray()
      : [];

    const courseMap = new Map();
    for (const c of courses) {
      courseMap.set(c._id.toHexString(), c);
    }

    const data = rows.map((enr) => {
      const c = enr.courseId ? courseMap.get(enr.courseId.toHexString()) : null;
      return {
        id: enr._id.toHexString(),
        progress: enr.progress || 0,
        status: enr.status || "active",
        enrolledAt: enr.enrolledAt,
        updatedAt: enr.updatedAt,
        lastAccessedAt: enr.lastAccessedAt,
        completedAt: enr.completedAt || null,
        course: c
          ? {
              id: c._id.toHexString(),
              title: c.title,
              description: c.description,
              category: c.category,
              level: c.level,
              duration: c.duration,
              lessons: c.lessonCount || c.lessons || 0,
              instructor: c.instructor || "Instructor",
              status: c.status,
            }
          : null,
      };
    });

    const pages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (error) {
    next(error);
  }
};

const enroll = async (req, res, next) => {
  try {
    const { courseId: rawCourseId } = req.body || {};
    if (!ObjectId.isValid(rawCourseId)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "A valid courseId is required." },
      });
    }

    const courseId = new ObjectId(rawCourseId);
    const studentId = new ObjectId(req.user.id);

    const course = await collection("courses").findOne({ _id: courseId, status: "published" });
    if (!course) {
      return res.status(404).json({
        success: false,
        error: { code: "COURSE_NOT_FOUND", message: "Published course not found." },
      });
    }

    const now = new Date();
    const result = await collection("enrollments").updateOne(
      { studentId, courseId },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          studentId,
          courseId,
          progress: 0,
          status: "active",
          enrolledAt: now,
          updatedAt: now,
          lastAccessedAt: now,
        },
      },
      { upsert: true }
    );

    const enrollment = await collection("enrollments").findOne({ studentId, courseId });

    return res.status(result.upsertedCount ? 201 : 200).json({
      success: true,
      data: {
        id: enrollment._id.toHexString(),
        courseId: courseId.toHexString(),
        progress: enrollment.progress,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateProgress = async (req, res, next) => {
  try {
    const rawId = req.params.enrollmentId;
    if (!ObjectId.isValid(rawId)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "A valid enrollmentId is required." },
      });
    }

    const enrollmentId = new ObjectId(rawId);
    const studentId = new ObjectId(req.user.id);
    const progress = Number(req.body?.progress);

    if (isNaN(progress) || progress < 0 || progress > 100) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_PROGRESS", message: "Progress must be a whole number between 0 and 100." },
      });
    }

    const now = new Date();
    const isCompleted = progress === 100;
    const status = isCompleted ? "completed" : "active";

    const update = {
      $set: {
        progress,
        status,
        updatedAt: now,
        lastAccessedAt: now,
        ...(isCompleted ? { completedAt: now } : {}),
      },
    };
    if (!isCompleted) {
      update.$unset = { completedAt: "" };
    }

    const result = await collection("enrollments").updateOne(
      { _id: enrollmentId, studentId },
      update
    );

    if (!result.matchedCount) {
      return res.status(404).json({
        success: false,
        error: { code: "ENROLLMENT_NOT_FOUND", message: "Enrollment not found." },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: enrollmentId.toHexString(),
        progress,
        status,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getStudentProgress = async (req, res, next) => {
  try {
    const studentId = new ObjectId(req.user.id);
    const enrollments = await collection("enrollments")
      .find({ studentId })
      .toArray();

    const coursesEnrolled = enrollments.length;
    const coursesCompleted = enrollments.filter((e) => e.status === "completed" || e.progress === 100).length;
    const averageProgress = coursesEnrolled
      ? Math.round(enrollments.reduce((acc, e) => acc + (e.progress || 0), 0) / coursesEnrolled)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        coursesEnrolled,
        coursesCompleted,
        averageProgress,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyEnrollments,
  enroll,
  updateProgress,
  getStudentProgress,
};
