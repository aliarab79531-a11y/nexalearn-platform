const { collection } = require("../config/db");
const ObjectId = require("../utils/objectId");

function formatCourse(course, instructorName) {
  const id = course._id instanceof ObjectId ? course._id.toHexString() : String(course._id || course.id);
  const lessonCount = course.lessonCount || course.lessons || (Array.isArray(course.modules) ? course.modules.reduce((acc, m) => acc + (m.lessons || 0), 0) : 0);

  return {
    id,
    _id: id,
    title: course.title || "",
    description: course.description || "",
    category: course.category || "General",
    level: course.level || "Beginner",
    duration: course.duration || "10h 00m",
    lessons: lessonCount,
    lessonCount,
    price: course.price !== undefined ? course.price : 0,
    modules: Array.isArray(course.modules) ? course.modules : [],
    instructor: instructorName || course.instructor || "Instructor",
    instructorId: course.instructorId ? (course.instructorId.toHexString ? course.instructorId.toHexString() : String(course.instructorId)) : null,
    status: course.status || "published",
    createdAt: course.createdAt || new Date(),
    updatedAt: course.updatedAt || new Date(),
    publishedAt: course.publishedAt || (course.status === "published" ? course.createdAt : null),
  };
}

async function getInstructorNames(courses) {
  const ids = [];
  for (const c of courses) {
    if (c.instructorId) {
      const idStr = c.instructorId.toHexString ? c.instructorId.toHexString() : String(c.instructorId);
      if (ObjectId.isValid(idStr) && !ids.some((existing) => existing.toHexString() === idStr)) {
        ids.push(new ObjectId(idStr));
      }
    }
  }

  const nameMap = new Map();
  if (ids.length) {
    const users = await collection("users")
      .find({ _id: { $in: ids } }, { projection: { name: 1 } })
      .toArray();
    for (const u of users) {
      nameMap.set(u._id.toHexString(), u.name);
    }
  }

  return nameMap;
}

// ========================================
// GET ALL COURSES (Search, Filter, Pagination)
// ========================================
const getCourses = async (req, res, next) => {
  try {
    const search = (req.query.q || req.query.search || "").trim();
    const category = (req.query.category || "").trim();
    const level = (req.query.level || "").trim();
    const status = req.query.status || "published";

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (status && status !== "all") {
      filter.status = status;
    }

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: regex }, { description: regex }, { category: regex }, { instructor: regex }];
    }

    if (category) {
      filter.category = category;
    }

    if (level && ["Beginner", "Intermediate", "Advanced"].includes(level)) {
      filter.level = level;
    }

    const coursesCol = collection("courses");
    const [courses, total] = await Promise.all([
      coursesCol.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(limit).toArray(),
      coursesCol.countDocuments(filter),
    ]);

    const instructorNames = await getInstructorNames(courses);
    const formatted = courses.map((c) => {
      const instId = c.instructorId ? (c.instructorId.toHexString ? c.instructorId.toHexString() : String(c.instructorId)) : null;
      const instName = (instId && instructorNames.get(instId)) || c.instructor || "NexaLearn Instructor";
      return formatCourse(c, instName);
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data: formatted,
      meta: {
        page,
        limit,
        total,
        pages: totalPages,
      },
      pagination: {
        currentPage: page,
        limit,
        totalCourses: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// GET COURSE BY ID
// ========================================
const getCourseById = async (req, res, next) => {
  try {
    const rawId = req.params.id || req.params.courseId;
    if (!ObjectId.isValid(rawId)) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Course not found." },
        message: "Course not found.",
      });
    }

    const courseId = new ObjectId(rawId);
    const coursesCol = collection("courses");
    const course = await coursesCol.findOne({ _id: courseId });

    if (!course) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Course not found." },
        message: "Course not found.",
      });
    }

    let instructorName = course.instructor || "NexaLearn Instructor";
    if (course.instructorId) {
      const instUser = await collection("users").findOne({ _id: course.instructorId });
      if (instUser) instructorName = instUser.name;
    }

    const formatted = formatCourse(course, instructorName);

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// CREATE COURSE
// ========================================
const createCourse = async (req, res, next) => {
  try {
    const body = req.body || {};
    const title = (body.title || "").trim();
    const description = (body.description || "").trim();
    const category = (body.category || "").trim();
    const level = body.level || "Beginner";
    const duration = (body.duration || "10h 00m").trim();
    const modules = Array.isArray(body.modules) ? body.modules : [];

    if (!title || title.length < 3) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_FIELD", message: "Title must be at least 3 characters." },
      });
    }

    const instructorId = req.user ? new ObjectId(req.user.id) : new ObjectId();
    const instructorName = req.user ? req.user.name : (body.instructor || "Instructor");

    let lessonCount = 0;
    const sanitizedModules = modules.map((m, idx) => {
      const lessons = parseInt(m.lessons, 10) || 1;
      lessonCount += lessons;
      return {
        title: m.title || `Module ${idx + 1}`,
        lessons,
        duration: m.duration || "1h 00m",
        topics: Array.isArray(m.topics) ? m.topics : [],
      };
    });

    const now = new Date();
    const newCourse = {
      _id: new ObjectId(),
      title,
      description,
      category: category || "General",
      level: ["Beginner", "Intermediate", "Advanced"].includes(level) ? level : "Beginner",
      duration,
      modules: sanitizedModules,
      lessonCount,
      lessons: lessonCount,
      price: Number(body.price) >= 0 ? Number(body.price) : 0,
      instructorId,
      instructor: instructorName,
      status: body.status === "published" ? "published" : "draft",
      createdAt: now,
      updatedAt: now,
      ...(body.status === "published" ? { publishedAt: now } : {}),
    };

    const coursesCol = collection("courses");
    await coursesCol.insertOne(newCourse);

    return res.status(201).json({
      success: true,
      data: formatCourse(newCourse, instructorName),
      message: "Course created successfully.",
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// UPDATE COURSE
// ========================================
const updateCourse = async (req, res, next) => {
  try {
    const rawId = req.params.id || req.params.courseId;
    if (!ObjectId.isValid(rawId)) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Course not found." },
      });
    }

    const courseId = new ObjectId(rawId);
    const coursesCol = collection("courses");
    const existing = await coursesCol.findOne({ _id: courseId });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Course not found." },
      });
    }

    // Check ownership if user is not admin
    if (req.user && req.user.role !== "admin") {
      const instId = existing.instructorId ? (existing.instructorId.toHexString ? existing.instructorId.toHexString() : String(existing.instructorId)) : null;
      if (instId && instId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "You do not have permission to update this course." },
        });
      }
    }

    const body = req.body || {};
    const modules = Array.isArray(body.modules) ? body.modules : existing.modules;
    let lessonCount = 0;
    const sanitizedModules = (modules || []).map((m, idx) => {
      const lessons = parseInt(m.lessons, 10) || 1;
      lessonCount += lessons;
      return {
        title: m.title || `Module ${idx + 1}`,
        lessons,
        duration: m.duration || "1h 00m",
        topics: Array.isArray(m.topics) ? m.topics : [],
      };
    });

    const now = new Date();
    const updated = {
      ...existing,
      title: body.title !== undefined ? body.title : existing.title,
      description: body.description !== undefined ? body.description : existing.description,
      category: body.category !== undefined ? body.category : existing.category,
      level: body.level !== undefined ? body.level : existing.level,
      duration: body.duration !== undefined ? body.duration : existing.duration,
      modules: sanitizedModules,
      lessonCount,
      lessons: lessonCount,
      price: body.price !== undefined ? Number(body.price) : existing.price,
      updatedAt: now,
    };

    await coursesCol.replaceOne({ _id: courseId }, updated);

    return res.status(200).json({
      success: true,
      data: formatCourse(updated, req.user ? req.user.name : existing.instructor),
      message: "Course updated successfully.",
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// DELETE COURSE
// ========================================
const deleteCourse = async (req, res, next) => {
  try {
    const rawId = req.params.id || req.params.courseId;
    if (!ObjectId.isValid(rawId)) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Course not found." },
      });
    }

    const courseId = new ObjectId(rawId);
    const coursesCol = collection("courses");
    const existing = await coursesCol.findOne({ _id: courseId });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Course not found." },
      });
    }

    if (req.user && req.user.role !== "admin") {
      const instId = existing.instructorId ? (existing.instructorId.toHexString ? existing.instructorId.toHexString() : String(existing.instructorId)) : null;
      if (instId && instId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "You do not have permission to delete this course." },
        });
      }
    }

    const enrollmentCount = await collection("enrollments").countDocuments({ courseId });
    if (enrollmentCount > 0) {
      return res.status(409).json({
        success: false,
        error: { code: "COURSE_HAS_ENROLLMENTS", message: "Courses with active enrollments cannot be deleted." },
      });
    }

    await coursesCol.deleteOne({ _id: courseId });

    return res.status(200).json({
      success: true,
      message: "Course deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// SET COURSE STATUS (publish / draft)
// ========================================
const setCourseStatus = async (req, res, next) => {
  try {
    const rawId = req.params.id || req.params.courseId;
    const { status } = req.body || {};

    if (status !== "draft" && status !== "published") {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_STATUS", message: "Status must be 'draft' or 'published'." },
      });
    }

    const courseId = new ObjectId(rawId);
    const coursesCol = collection("courses");
    const existing = await coursesCol.findOne({ _id: courseId });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Course not found." },
      });
    }

    const now = new Date();
    await coursesCol.updateOne(
      { _id: courseId },
      {
        $set: {
          status,
          updatedAt: now,
          ...(status === "published" ? { publishedAt: now } : {}),
        },
        ...(status === "draft" ? { $unset: { publishedAt: "" } } : {}),
      }
    );

    return res.status(200).json({
      success: true,
      data: { id: courseId.toHexString(), status },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  setCourseStatus,
};
